// The events a venue's manager publishes in the venue's calendar, open to all,
// league teams or not and players alone: a night session, and what comes next.
// Offered to no team. The teams whose venue it is see each in their calendar,
// not taken yet; those who make a team's events add it there, a copy tied to
// it, gone when the venue withdraws it, the team told.

import { prisma } from '@db/prisma';
import { isUniqueViolation } from '@db/prisma-errors';
import { ERROR } from '@shared/constants';
import type { VenueEventSummary, VenueEventView, VenuePublicationFacts } from '@shared/types';
import { toParisTime } from '@shared/utils/date.utils';
import { notifyVenueEventWithdrawn } from '@services/venue-publication-notification.service';
import { formatDateStr } from './helpers/date.helper';
import { parseVenuePublication, type VenuePublicationInput } from './helpers/venue-publication.helper';

const EVENT_SELECT = {
  id: true, title: true, date: true, startTime: true, endTime: true, description: true, venue: { select: { name: true } },
} as const;

type EventRow = {
  id: string; title: string; date: Date; startTime: string; endTime: string; description: string | null; venue: { name: string };
};

function toView(row: EventRow): VenueEventView {
  return {
    id: row.id,
    venueName: row.venue.name,
    title: row.title,
    date: formatDateStr(row.date),
    startTime: row.startTime,
    endTime: row.endTime,
    description: row.description,
  };
}

// What a withdrawal tells the teams that added it
function toFacts(view: VenueEventView): VenuePublicationFacts {
  const { title, venueName, date, startTime, endTime, description } = view;
  return { title, venueName, date, startTime, endTime, description };
}

/** The events of a venue still to come, from today in Paris on, the soonest first, and how many teams added each */
export async function listVenueEvents(venueId: string, now: Date = new Date()): Promise<VenueEventSummary[]> {
  const rows = await prisma.venueEvent.findMany({
    where: { venueId, date: { gte: new Date(toParisTime(now).day) } },
    select: { ...EVENT_SELECT, _count: { select: { teamEvents: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  return rows.map(row => ({ ...toView(row), teamsAdding: row._count.teamEvents }));
}

/**
 * Publish an event: a title, a day from today in Paris on, hours that end
 * after they start, and a description of a few lines at most. Nobody is told:
 * it is offered to no team, the teams of the venue see it in their calendar.
 */
export async function createVenueEvent(
  venueId: string,
  input: Partial<VenuePublicationInput>,
  now: Date = new Date(),
): Promise<{ error: string } | VenueEventSummary> {
  const publication = parseVenuePublication(input, now);
  if ('error' in publication) return publication;
  const { title, date, startTime, endTime, description } = publication;
  const row = await prisma.venueEvent.create({
    data: { venueId, title, date: new Date(date), startTime, endTime, description },
    select: EVENT_SELECT,
  });
  return { ...toView(row), teamsAdding: 0 };
}

/**
 * Withdraw an event of a venue, and with it the copies of the teams that added
 * it, which are told. False when the venue has no such event.
 */
export async function deleteVenueEvent(venueId: string, eventId: string): Promise<boolean> {
  const event = await prisma.venueEvent.findFirst({
    where: { id: eventId, venueId },
    select: { ...EVENT_SELECT, teamEvents: { select: { teamId: true } } },
  });
  if (!event) return false;

  const { count } = await prisma.venueEvent.deleteMany({ where: { id: eventId, venueId } });
  if (!count) return false; // Withdrawn meanwhile: told by that withdrawal
  const teamIds = [...new Set(event.teamEvents.map(copy => copy.teamId).filter((teamId): teamId is string => teamId !== null))];
  await notifyVenueEventWithdrawn(toFacts(toView(event)), teamIds);
  return true;
}

/**
 * The events of a team's venue, its affiliation, between two days, that the
 * team has not added to its calendar: shown there as not taken yet. From
 * today in Paris on: a day gone by has nothing left to take.
 */
export async function venueEventsForTeam(
  teamId: string,
  from: Date,
  to: Date,
  now: Date = new Date(),
): Promise<VenueEventView[]> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { venueId: true } });
  if (!team?.venueId) return [];
  const today = new Date(toParisTime(now).day);
  const rows = await prisma.venueEvent.findMany({
    where: { venueId: team.venueId, date: { gte: from > today ? from : today, lte: to }, teamEvents: { none: { teamId } } },
    select: EVENT_SELECT,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  return rows.map(toView);
}

/**
 * Add an event of a venue to a team's calendar, by one who makes the team's
 * events: the team's copy, an event, tied to the venue's. Open to all, an
 * event of any venue is added the same way; once only for a team, and not
 * once its day has gone by.
 */
export async function addVenueEventToTeam(
  teamId: string,
  playerId: string,
  venueEventId: string,
  now: Date = new Date(),
): Promise<{ error: string } | { eventId: string }> {
  const event = await prisma.venueEvent.findUnique({
    where: { id: venueEventId },
    select: { title: true, date: true, startTime: true, endTime: true, description: true },
  });
  if (!event) return { error: ERROR.venueEventNotFound };
  if (formatDateStr(event.date) < toParisTime(now).day) return { error: ERROR.venueEventPast };
  try {
    const copy = await prisma.calendarEvent.create({
      data: { type: 'EVENT', ...event, teamId, createdById: playerId, venueEventId },
      select: { id: true },
    });
    return { eventId: copy.id };
  } catch (error) {
    // The team's copy already there, or added at the same moment
    if (isUniqueViolation(error)) return { error: ERROR.venueEventAlreadyAdded };
    throw error;
  }
}
