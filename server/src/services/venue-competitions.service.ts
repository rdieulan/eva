// The competitions a venue's manager publishes in the venue's calendar and
// offers its teams: the days of a division of its local league, and the
// venue's tournaments. The manager gives the dates: those of a month past
// say nothing of the next ones.

import { prisma } from '@db/prisma';
import { isForeignKeyViolation, isUniqueViolation } from '@db/prisma-errors';
import { ERROR } from '@shared/constants';
import type { VenuePublicationFacts, VenueCompetitionView } from '@shared/types';
import { toParisTime } from '@shared/utils/date.utils';
import { competitionKind } from '@shared/utils';
import {
  announceOnVenueDiscord,
  notifyCompetitionAdded,
  notifyCompetitionOffered,
  notifyCompetitionChanged,
  notifyCompetitionWithdrawn,
} from '@services/venue-publication-notification.service';
import { formatDateStr } from './helpers/date.helper';
import { parseVenuePublication, samePublication, timingBefore, type VenuePublicationInput } from './helpers/venue-publication.helper';

/** A competition as its manager publishes it: a publication, and the division whose day it is */
export interface VenueCompetitionInput extends VenuePublicationInput {
  division: number | null;
}

type CompetitionRow = {
  id: string; division: number | null; title: string; date: Date; startTime: string; endTime: string; description: string | null;
  offers: { status: 'PENDING' | 'ACCEPTED' | 'REFUSED' }[];
};

const COMPETITION_SELECT = {
  id: true, division: true, title: true, date: true, startTime: true, endTime: true, description: true,
  offers: { select: { status: true } },
} as const;

function toView({ offers, ...row }: CompetitionRow): VenueCompetitionView {
  const count = (status: CompetitionRow['offers'][number]['status']) => offers.filter(offer => offer.status === status).length;
  return { ...row, date: formatDateStr(row.date), answers: { pending: count('PENDING'), accepted: count('ACCEPTED'), refused: count('REFUSED') } };
}

// What a competition's notifications tell of it
const FACTS_SELECT = {
  title: true, date: true, startTime: true, endTime: true, description: true, venue: { select: { name: true } },
} as const;

type FactsRow = {
  title: string; date: Date; startTime: string; endTime: string; description: string | null; venue: { name: string };
};

// Field by field: a notification keeps its facts as they are, nothing more
function toFacts(row: FactsRow): VenuePublicationFacts {
  return {
    title: row.title,
    venueName: row.venue.name,
    date: formatDateStr(row.date),
    startTime: row.startTime,
    endTime: row.endTime,
    description: row.description,
  };
}

// The teams of ours a competition goes to: for a division's day, those whose
// league team the manager placed in that division; for a tournament of the
// venue, every team of the venue, of its league or affiliated to it. Read at
// publication, and again whenever that changes (see syncCompetitionOffers).
async function teamsFor(venueId: string, division: number | null): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: division === null
      ? { OR: [{ venueId }, { leagueTeam: { divisionPlace: { venueId } } }] }
      : { leagueTeam: { divisionPlace: { venueId, division } } },
    select: { id: true },
  });
  return teams.map(team => team.id);
}

/** The venue of the local league a league team plays in, when its manager placed it there */
export async function leagueVenueOf(leagueTeamId: string | null | undefined): Promise<string | null> {
  if (!leagueTeamId) return null;
  const place = await prisma.leagueDivisionPlace.findUnique({ where: { leagueTeamId }, select: { venueId: true } });
  return place?.venueId ?? null;
}

// One competition offered again to the teams it is for now: those newly
// concerned get it, those no longer concerned lose it if they had not answered
async function syncOffers(
  competition: FactsRow & { id: string; offers: { teamId: string; status: 'PENDING' | 'ACCEPTED' | 'REFUSED' }[] },
  wanted: Set<string>,
): Promise<void> {
  const dropped = competition.offers.filter(offer => offer.status === 'PENDING' && !wanted.has(offer.teamId));
  if (dropped.length) {
    await prisma.venueCompetitionOffer.deleteMany({
      where: { competitionId: competition.id, teamId: { in: dropped.map(offer => offer.teamId) }, status: 'PENDING' },
    });
  }

  const offered = new Set(competition.offers.map(offer => offer.teamId));
  const added: string[] = [];
  for (const teamId of wanted) {
    if (offered.has(teamId)) continue;
    try {
      await prisma.venueCompetitionOffer.create({ data: { competitionId: competition.id, teamId }, select: { teamId: true } });
      added.push(teamId);
    } catch (error) {
      // Offered at the same moment by another change, told by that one; or the competition withdrawn meanwhile
      if (isForeignKeyViolation(error)) break;
      if (!isUniqueViolation(error)) throw error;
    }
  }
  if (added.length) await notifyCompetitionOffered(toFacts(competition), added);
}

/**
 * Offer the competitions still to come of these venues to the teams they are
 * for now, whatever changed it since they were published: a team placed in a
 * division or moved to another, a team arrived on the app, linked to its
 * league team or affiliated to the venue. A team newly concerned gets the
 * offer, and those who answer for it are told; a team no longer concerned
 * loses the offer it had not answered. What a team answered stays as it is: a
 * competition it accepted stays in its calendar.
 */
export async function syncCompetitionOffers(venueIds: (string | null | undefined)[], now: Date = new Date()): Promise<void> {
  const today = new Date(toParisTime(now).day);
  for (const venueId of new Set(venueIds.filter((id): id is string => !!id))) {
    const competitions = await prisma.venueCompetition.findMany({
      where: { venueId, date: { gte: today } },
      select: { ...FACTS_SELECT, id: true, division: true, offers: { select: { teamId: true, status: true } } },
    });
    // The teams of a division, or of the whole venue, read once for all its competitions
    const teams = new Map<number | null, Set<string>>();
    for (const competition of competitions) {
      if (!teams.has(competition.division)) teams.set(competition.division, new Set(await teamsFor(venueId, competition.division)));
      await syncOffers(competition, teams.get(competition.division)!);
    }
  }
}

/** The competitions of a venue from a day on, up to another when given, the soonest first */
export async function venueCompetitionsBetween(venueId: string, from: Date, to?: Date): Promise<VenueCompetitionView[]> {
  const rows = await prisma.venueCompetition.findMany({
    where: { venueId, date: { gte: from, ...(to ? { lte: to } : {}) } },
    select: COMPETITION_SELECT,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  return rows.map(toView);
}

/** The competitions of a venue still to come, from today in Paris on, the soonest first */
export async function listVenueCompetitions(venueId: string, now: Date = new Date()): Promise<VenueCompetitionView[]> {
  return venueCompetitionsBetween(venueId, new Date(toParisTime(now).day));
}

/**
 * Publish a competition: a title, a day from today in Paris on, hours that
 * end after they start, and for a division's day a division the venue's
 * league has. A description is optional, a few lines at most. It goes at once
 * to the teams it is for, to accept into their calendar or refuse, and those
 * who answer for them are told; the venue's own Discord hears of it.
 */
export async function createVenueCompetition(
  venueId: string,
  input: Partial<VenueCompetitionInput>,
  now: Date = new Date(),
): Promise<{ error: string } | VenueCompetitionView> {
  const publication = parseVenuePublication(input, now);
  if ('error' in publication) return publication;
  const { title, date, startTime, endTime, description } = publication;

  const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId }, select: { name: true, leagueDivisionCount: true } });
  const division = input.division ?? null;
  if (division !== null && (!Number.isInteger(division) || division < 1 || division > venue.leagueDivisionCount)) {
    return { error: ERROR.competitionDivisionInvalid };
  }

  const teamIds = await teamsFor(venueId, division);
  const row = await prisma.venueCompetition.create({
    data: {
      venueId, division, title, date: new Date(date), startTime, endTime, description,
      offers: { create: teamIds.map(teamId => ({ teamId })) },
    },
    select: COMPETITION_SELECT,
  });
  const facts = { title, venueName: venue.name, date, startTime, endTime, description };
  await notifyCompetitionOffered(facts, teamIds);
  announceOnVenueDiscord(venueId, { subject: 'competition', change: 'published', facts, kind: competitionKind({ division }) });
  return toView(row);
}

/**
 * Change a competition of a venue, checked as at publication: its day, its
 * hours, its title, its description, or the division whose day it is. The
 * copies of the teams that accepted it follow. The teams it went to are told,
 * as on its withdrawal, and so is the venue's own Discord; the teams a new
 * division adds get it offered, those it leaves lose it if they had not
 * answered. Null when the venue has no such competition; nothing told when
 * nothing changed.
 */
export async function updateVenueCompetition(
  venueId: string,
  competitionId: string,
  input: Partial<VenueCompetitionInput>,
  now: Date = new Date(),
): Promise<{ error: string } | VenueCompetitionView | null> {
  const publication = parseVenuePublication(input, now);
  if ('error' in publication) return publication;

  const current = await prisma.venueCompetition.findFirst({
    where: { id: competitionId, venueId },
    select: { ...FACTS_SELECT, division: true, venue: { select: { name: true, leagueDivisionCount: true } } },
  });
  if (!current) return null;
  const division = input.division ?? null;
  if (division !== null && (!Number.isInteger(division) || division < 1 || division > current.venue.leagueDivisionCount)) {
    return { error: ERROR.competitionDivisionInvalid };
  }

  const before = toFacts(current);
  const unchanged = samePublication(before, publication) && division === current.division;
  const { title, date, startTime, endTime, description } = publication;
  const row = unchanged
    ? await prisma.venueCompetition.findUniqueOrThrow({ where: { id: competitionId }, select: COMPETITION_SELECT })
    : await prisma.$transaction(async tx => {
      // The teams' copies follow it
      await tx.calendarEvent.updateMany({
        where: { venueCompetitionId: competitionId },
        data: { title, date: new Date(date), startTime, endTime, description },
      });
      return tx.venueCompetition.update({
        where: { id: competitionId },
        data: { division, title, date: new Date(date), startTime, endTime, description },
        select: COMPETITION_SELECT,
      });
    });
  if (unchanged) return toView(row);

  // A team that keeps it hears of the change; one a new division adds is offered it (see syncCompetitionOffers)
  const kept = new Set((await prisma.venueCompetitionOffer.findMany({ where: { competitionId }, select: { teamId: true } })).map(offer => offer.teamId));
  if (division !== current.division) await syncCompetitionOffers([venueId], now);
  const offers = await prisma.venueCompetitionOffer.findMany({
    where: { competitionId, teamId: { in: [...kept] } },
    select: { teamId: true, status: true, team: { select: { calendarEvents: { where: { venueCompetitionId: competitionId }, select: { id: true } } } } },
  });
  const facts = { ...before, title, date, startTime, endTime, description };
  const timing = timingBefore(before, facts);
  await notifyCompetitionChanged(facts, timing, offers.map(offer => ({
    teamId: offer.teamId, status: offer.status, eventId: offer.team.calendarEvents[0]?.id ?? null,
  })));
  announceOnVenueDiscord(venueId, { subject: 'competition', change: 'changed', facts, kind: competitionKind({ division }), before: timing });
  return toView(await prisma.venueCompetition.findUniqueOrThrow({ where: { id: competitionId }, select: COMPETITION_SELECT }));
}

/**
 * Withdraw a competition of a venue, and with it what the teams said and the
 * events of the teams that accepted it; the teams that accepted it or had not
 * answered yet are told, and so is the venue's own Discord. False when the
 * venue has no such competition.
 */
export async function deleteVenueCompetition(venueId: string, competitionId: string): Promise<boolean> {
  const competition = await prisma.venueCompetition.findFirst({
    where: { id: competitionId, venueId },
    select: { ...FACTS_SELECT, division: true, offers: { select: { teamId: true, status: true } } },
  });
  if (!competition) return false;

  const { count } = await prisma.venueCompetition.deleteMany({ where: { id: competitionId, venueId } });
  if (!count) return false; // Withdrawn meanwhile: told by that withdrawal
  const facts = toFacts(competition);
  await notifyCompetitionWithdrawn(facts, competition.offers);
  announceOnVenueDiscord(venueId, { subject: 'competition', change: 'withdrawn', facts, kind: competitionKind(competition) });
  return true;
}

/**
 * A team's answer to a competition its venue published for it, by one who can
 * create the team's events. Accepted, the competition joins the team's
 * calendar as a competition, the team's copy of the venue's: withdrawn by the
 * venue, it goes. The rest of the team is told of it; a refusal tells nobody.
 * Answered once: an offer no longer pending is not found.
 */
export async function answerCompetitionOffer(
  teamId: string,
  playerId: string,
  competitionId: string,
  answer: 'ACCEPTED' | 'REFUSED',
): Promise<{ error: string } | { eventId: string | null }> {
  type Outcome = { error: string } | { added: { eventId: string; facts: VenuePublicationFacts } | null };
  const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
    // Only while it is pending: of two answers at once, the first counts
    const { count } = await tx.venueCompetitionOffer.updateMany({
      where: { competitionId, teamId, status: 'PENDING' },
      data: { status: answer, answeredAt: new Date() },
    });
    if (!count) return { error: ERROR.competitionOfferNotFound };
    if (answer === 'REFUSED') return { added: null };

    const competition = await tx.venueCompetition.findUniqueOrThrow({ where: { id: competitionId }, select: FACTS_SELECT });
    const event = await tx.calendarEvent.create({
      data: {
        type: 'COMPETITION',
        title: competition.title,
        date: competition.date,
        startTime: competition.startTime,
        endTime: competition.endTime,
        description: competition.description,
        teamId,
        createdById: playerId,
        venueCompetitionId: competitionId,
      },
      select: { id: true },
    });
    return { added: { eventId: event.id, facts: toFacts(competition) } };
  });

  if ('error' in outcome) return outcome;
  if (!outcome.added) return { eventId: null };
  const { eventId, facts } = outcome.added;
  await notifyCompetitionAdded(facts, { teamId, eventId, acceptedBy: playerId });
  return { eventId };
}
