// The competitions a venue's manager publishes in the venue's calendar and
// offers its teams: the days of a division of its local league, and the
// venue's tournaments. The manager gives the dates: those of a month past
// say nothing of the next ones.

import { prisma } from '@db/prisma';
import { ERROR, VENUE_COMPETITION_DESCRIPTION_MAX, VENUE_COMPETITION_TITLE_MAX } from '@shared/constants';
import type { CompetitionFacts, VenueCompetitionView } from '@shared/types';
import { toParisTime } from '@shared/utils/date.utils';
import {
  notifyCompetitionAdded,
  notifyCompetitionOffered,
  notifyCompetitionWithdrawn,
} from '@services/competition-notification.service';
import { formatDateStr } from './helpers/date.helper';
import { isValidDate, isValidTime, isValidTimeRange } from './helpers/validation.helper';

/** A competition as its manager publishes it */
export interface VenueCompetitionInput {
  division: number | null;
  title: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  description: string | null;
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
function toFacts(row: FactsRow): CompetitionFacts {
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
// venue, every team of the venue, of its league or affiliated to it
//TODO(compétitions de salle) read once, at publication: a team placed or moved in the divisions afterwards does not follow the competitions already published
async function teamsFor(venueId: string, division: number | null): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: division === null
      ? { OR: [{ venueId }, { leagueTeam: { divisionPlace: { venueId } } }] }
      : { leagueTeam: { divisionPlace: { venueId, division } } },
    select: { id: true },
  });
  return teams.map(team => team.id);
}

/** The competitions of a venue still to come, from today in Paris on, the soonest first */
export async function listVenueCompetitions(venueId: string, now: Date = new Date()): Promise<VenueCompetitionView[]> {
  const rows = await prisma.venueCompetition.findMany({
    where: { venueId, date: { gte: new Date(toParisTime(now).day) } },
    select: COMPETITION_SELECT,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  return rows.map(toView);
}

/**
 * Publish a competition: a title, a day from today in Paris on, hours that
 * end after they start, and for a division's day a division the venue's
 * league has. A description is optional, a few lines at most. It goes at once
 * to the teams it is for, to accept into their calendar or refuse, and those
 * who answer for them are told.
 */
export async function createVenueCompetition(
  venueId: string,
  input: Partial<VenueCompetitionInput>,
  now: Date = new Date(),
): Promise<{ error: string } | VenueCompetitionView> {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' && input.description.trim() ? input.description.trim() : null;
  const { date, startTime, endTime } = input;
  if (
    !title || [...title].length > VENUE_COMPETITION_TITLE_MAX
    || !isValidDate(date) || date < toParisTime(now).day
    || !isValidTime(startTime) || !isValidTime(endTime) || !isValidTimeRange(startTime, endTime)
  ) {
    return { error: ERROR.competitionInvalid };
  }
  if (description && [...description].length > VENUE_COMPETITION_DESCRIPTION_MAX) {
    return { error: ERROR.competitionDescriptionTooLong };
  }

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
  await notifyCompetitionOffered({ title, venueName: venue.name, date, startTime, endTime, description }, teamIds);
  return toView(row);
}

/**
 * Withdraw a competition of a venue, and with it what the teams said and the
 * events of the teams that accepted it; the teams that accepted it or had not
 * answered yet are told. False when the venue has no such competition.
 */
export async function deleteVenueCompetition(venueId: string, competitionId: string): Promise<boolean> {
  const competition = await prisma.venueCompetition.findFirst({
    where: { id: competitionId, venueId },
    select: { ...FACTS_SELECT, offers: { select: { teamId: true, status: true } } },
  });
  if (!competition) return false;

  const { count } = await prisma.venueCompetition.deleteMany({ where: { id: competitionId, venueId } });
  if (!count) return false; // Withdrawn meanwhile: told by that withdrawal
  await notifyCompetitionWithdrawn(toFacts(competition), competition.offers);
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
  type Outcome = { error: string } | { added: { eventId: string; facts: CompetitionFacts } | null };
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
