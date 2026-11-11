// The home dashboard: what a player of a team has to do, or to know, soon, the
// most pressing first. Each item stops being of use at a moment, its due, in
// Paris time; those with none come last. A player sees what is theirs to do:
// the matches, the competitions and their own availability; and what their
// permissions let them answer: the league registration, the proposals of
// matches, the competitions of their venues, the requests to join.

import { prisma } from '@db/prisma';
import type { AccountPermissions, Dashboard, DashboardItem, DashboardMatch, DashboardNext } from '@shared/types';
import { shiftDay, toParisTime } from '@shared/utils/date.utils';
import { getVenueSlots } from '@services/venue-slots.service';
import { formatDateStr } from './helpers/date.helper';
import { logger } from '../utils/logger';

// The matches and competitions of the coming week, today included
const MATCH_DAYS = 7;

/** Who reads the dashboard: a player of a team, and what they may do there */
export interface DashboardReader {
  playerId: string;
  teamId: string;
  permissions: AccountPermissions;
}

// Every day from a day on, `count` of them, YYYY-MM-DD
function daysFrom(first: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftDay(first, index));
}

// What eva.gg counts on the slots of a match: the fewest players booked, and
// whether its slots differ. Null when it has none, or eva.gg does not answer.
async function headcountOf(venueId: string | null, date: string, evaSlotIds: string[]): Promise<DashboardMatch['headcount']> {
  if (!venueId || !evaSlotIds.length) return null;
  try {
    const read = await getVenueSlots(venueId, date);
    if (!('slots' in read)) return null;
    const seats = evaSlotIds
      .map(id => read.slots.find(slot => slot.slotId === id)?.takenSeats)
      .filter((taken): taken is number => taken !== undefined);
    if (!seats.length) return null;
    return { takenSeats: Math.min(...seats), varies: new Set(seats).size > 1 };
  } catch (error) {
    logger.warn(`Dashboard: eva.gg could not give the slots of venue ${venueId} on ${date}`, error);
    return null;
  }
}

// The days among these the reader said they cannot play
async function unavailableDaysOf(playerId: string, dates: Date[]): Promise<Set<string>> {
  if (!dates.length) return new Set();
  const unavailable = await prisma.availability.findMany({
    where: { playerId, status: 'UNAVAILABLE', date: { in: dates } },
    select: { date: true },
  });
  return new Set(unavailable.map(availability => formatDateStr(availability.date)));
}

// The team's matches of the coming week not over yet, with their bookings
async function matchItems(reader: DashboardReader, today: string, nowTime: string): Promise<DashboardItem[]> {
  const events = await prisma.calendarEvent.findMany({
    where: { teamId: reader.teamId, type: 'MATCH', date: { gte: new Date(today), lte: new Date(shiftDay(today, MATCH_DAYS - 1)) } },
    select: {
      id: true, date: true, startTime: true, endTime: true, title: true, arenaNumber: true, evaSlotIds: true, venueId: true,
      venue: { select: { name: true, externalId: true } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  const upcoming = events.filter(event => formatDateStr(event.date) > today || event.endTime > nowTime);
  if (!upcoming.length) return [];
  const unavailableDays = await unavailableDaysOf(reader.playerId, upcoming.map(event => event.date));

  return Promise.all(upcoming.map(async (event): Promise<DashboardItem> => {
    const date = formatDateStr(event.date);
    return {
      kind: 'MATCH',
      due: `${date}T${event.startTime}`,
      data: {
        eventId: event.id,
        date,
        startTime: event.startTime,
        endTime: event.endTime,
        title: event.title,
        venueName: event.venue?.name ?? null,
        arenaNumber: event.arenaNumber,
        evaLocationId: event.venue?.externalId ?? null,
        headcount: await headcountOf(event.venueId, date, event.evaSlotIds),
        isUnavailable: unavailableDays.has(date),
      },
    };
  }));
}

// The team's competitions of the coming week not over yet: a day of its
// division, a tournament, a month of its league
async function competitionItems(reader: DashboardReader, today: string, nowTime: string): Promise<DashboardItem[]> {
  const events = await prisma.calendarEvent.findMany({
    where: { teamId: reader.teamId, type: 'COMPETITION', date: { gte: new Date(today), lte: new Date(shiftDay(today, MATCH_DAYS - 1)) } },
    select: {
      id: true, date: true, startTime: true, endTime: true, title: true,
      venueCompetition: { select: { venue: { select: { name: true } } } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  const upcoming = events.filter(event => formatDateStr(event.date) > today || event.endTime > nowTime);
  const unavailableDays = await unavailableDaysOf(reader.playerId, upcoming.map(event => event.date));
  return upcoming.map(event => {
    const date = formatDateStr(event.date);
    return {
      kind: 'COMPETITION',
      due: `${date}T${event.startTime}`,
      data: {
        eventId: event.id,
        date,
        startTime: event.startTime,
        endTime: event.endTime,
        title: event.title,
        venueName: event.venueCompetition?.venue.name ?? null,
        isUnavailable: unavailableDays.has(date),
      },
    };
  });
}

// The days ahead, as far as the team asks, the reader has given no availability for
async function availabilityItem(reader: DashboardReader, today: string): Promise<DashboardItem[]> {
  const team = await prisma.team.findUniqueOrThrow({ where: { id: reader.teamId }, select: { availabilityHorizonDays: true } });
  const days = daysFrom(today, team.availabilityHorizonDays);
  const given = await prisma.availability.findMany({
    where: { playerId: reader.playerId, date: { gte: new Date(days[0]!), lte: new Date(days.at(-1)!) } },
    select: { date: true },
  });
  const givenDays = new Set(given.map(availability => formatDateStr(availability.date)));
  const missing = days.filter(day => !givenDays.has(day));
  if (!missing.length) return [];
  return [{
    kind: 'AVAILABILITY',
    due: `${missing[0]}T00:00`,
    data: { missingDays: missing.length, horizonDays: team.availabilityHorizonDays, firstMissingDate: missing[0]! },
  }];
}

// The months of the team's local league open to registration, the team not
// registered, under the name the team registers with there. None for a team
// linked to no league team: what was read of one goes with its link.
async function leagueItems(reader: DashboardReader, now: Date): Promise<DashboardItem[]> {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: reader.teamId },
    select: {
      leagueTeam: { select: { name: true } },
      leagueEntries: {
        where: { registeredAt: null, tournament: { registrationClosesAt: { gt: now } } },
        select: { tournament: { select: { id: true, name: true, registrationClosesAt: true } } },
      },
    },
  });
  if (!team.leagueTeam) return [];
  const leagueTeamName = team.leagueTeam.name;
  return team.leagueEntries.map(({ tournament }) => {
    const closes = toParisTime(tournament.registrationClosesAt!);
    return {
      kind: 'LEAGUE_REGISTRATION',
      due: `${closes.day}T${closes.time}`,
      data: {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        leagueTeamName,
        closesAt: tournament.registrationClosesAt!.toISOString(),
      },
    };
  });
}

// The matches other teams proposed on the team's open searches, still to be played
async function proposalItems(reader: DashboardReader, today: string, nowTime: string): Promise<DashboardItem[]> {
  const proposals = await prisma.scrimProposal.findMany({
    where: { status: 'PENDING', search: { teamId: reader.teamId, status: 'OPEN', date: { gte: new Date(today) } } },
    select: {
      id: true, searchId: true, startTime: true, endTime: true, arenaNumber: true, venueId: true,
      team: { select: { id: true, name: true } },
      venue: { select: { name: true } },
      search: { select: { date: true } },
    },
  });
  return proposals
    .map(proposal => ({ proposal, date: formatDateStr(proposal.search.date) }))
    .filter(({ proposal, date }) => date > today || proposal.startTime > nowTime)
    .map(({ proposal, date }) => ({
      kind: 'SCRIM_PROPOSAL',
      due: `${date}T${proposal.startTime}`,
      data: {
        proposalId: proposal.id,
        searchId: proposal.searchId,
        teamId: proposal.team.id,
        teamName: proposal.team.name,
        date,
        startTime: proposal.startTime,
        endTime: proposal.endTime,
        venueId: proposal.venueId,
        venueName: proposal.venue.name,
        arenaNumber: proposal.arenaNumber,
      },
    }));
}

// The competitions the team's venues published for it, still to come and not answered
async function competitionOfferItems(reader: DashboardReader, today: string, nowTime: string): Promise<DashboardItem[]> {
  const offers = await prisma.venueCompetitionOffer.findMany({
    where: { teamId: reader.teamId, status: 'PENDING', competition: { date: { gte: new Date(today) } } },
    select: {
      competition: {
        select: {
          id: true, division: true, title: true, date: true, startTime: true, endTime: true, description: true,
          venue: { select: { name: true } },
        },
      },
    },
  });
  return offers
    .map(({ competition }) => ({ competition, date: formatDateStr(competition.date) }))
    .filter(({ competition, date }) => date > today || competition.endTime > nowTime)
    .map(({ competition, date }) => ({
      kind: 'COMPETITION_OFFER',
      due: `${date}T${competition.startTime}`,
      data: {
        competitionId: competition.id,
        venueName: competition.venue.name,
        division: competition.division,
        title: competition.title,
        date,
        startTime: competition.startTime,
        endTime: competition.endTime,
        description: competition.description,
      },
    }));
}

// How many players wait for an answer to join the team
async function joinRequestItems(reader: DashboardReader): Promise<DashboardItem[]> {
  const count = await prisma.teamJoinRequest.count({ where: { teamId: reader.teamId, status: 'PENDING' } });
  return count ? [{ kind: 'JOIN_REQUESTS', due: null, data: { count } }] : [];
}

// The team's next match or competition beyond the coming week, whose matches and competitions are items
async function nextBeyondWeek(reader: DashboardReader, today: string): Promise<DashboardNext | null> {
  const event = await prisma.calendarEvent.findFirst({
    where: { teamId: reader.teamId, type: { in: ['MATCH', 'COMPETITION'] }, date: { gt: new Date(shiftDay(today, MATCH_DAYS - 1)) } },
    select: { id: true, type: true, date: true, startTime: true, title: true },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  if (!event || (event.type !== 'MATCH' && event.type !== 'COMPETITION')) return null;
  return { eventId: event.id, type: event.type, date: formatDateStr(event.date), startTime: event.startTime, title: event.title };
}

/**
 * The dashboard of a player of a team: their team's matches and competitions
 * of the coming week, their own availability left to give, and, as their
 * permissions let them, the league registration, the proposals of matches,
 * the competitions of their venues and the requests to join to answer. The
 * soonest due first; what has none, last. With nothing to do, the team's next
 * match or competition all the same, when it has one.
 */
export async function getDashboard(reader: DashboardReader, now: Date = new Date()): Promise<Dashboard> {
  const { day: today, time: nowTime } = toParisTime(now);
  const groups = await Promise.all([
    matchItems(reader, today, nowTime),
    competitionItems(reader, today, nowTime),
    availabilityItem(reader, today),
    reader.permissions.team.canManageTeam ? leagueItems(reader, now) : [],
    reader.permissions.matchmaking.canRespond ? proposalItems(reader, today, nowTime) : [],
    reader.permissions.calendar.canCreateEvents ? competitionOfferItems(reader, today, nowTime) : [],
    reader.permissions.team.canInviteMembers ? joinRequestItems(reader) : [],
  ]);
  const items = groups.flat().sort((a, b) => Number(a.due === null) - Number(b.due === null) || (a.due ?? '').localeCompare(b.due ?? ''));
  return { items, next: items.length ? null : await nextBeyondWeek(reader, today) };
}
