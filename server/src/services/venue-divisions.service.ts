// The divisions of a venue's local league, as its manager arranges them.
// competitive.eva.gg tells a month's divisions only once the month is drawn,
// at the close of its registration, too late to plan its days: the manager
// keeps them here, starting from the last month drawn on the site, and moves
// the teams that went up or down. Only what the manager saves is used.

import { prisma } from '@db/prisma';
import { ERROR, LEAGUE_DIVISIONS_MAX } from '@shared/constants';
import type { DivisionPlace, ManagedVenue, VenueDivisions, VenueDivisionsRead } from '@shared/types';
import { fetchLeagueMonthDivisions } from '../integrations/competitive/competitive-teams';
import { LEAGUE_TEAM_SUMMARY_SELECT, toLeagueTeamSummary } from './league-directory.service';
import { syncCompetitionOffers } from './venue-competitions.service';
import { logger } from '../utils/logger';

/** The venues a manager manages, by name */
export async function getManagedVenues(managerId: string): Promise<ManagedVenue[]> {
  const links = await prisma.venueManager.findMany({
    where: { managerId },
    select: { venue: { select: { id: true, name: true, city: true } } },
  });
  return links.map(link => link.venue).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Whether a manager manages a venue */
export async function managesVenue(managerId: string, venueId: string): Promise<boolean> {
  return (await prisma.venueManager.count({ where: { managerId, venueId } })) > 0;
}

/** The divisions of a venue's league: each league team placed, column by column, in order */
export async function getVenueDivisions(venueId: string): Promise<VenueDivisions | null> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      name: true,
      leagueDivisionCount: true,
      leagueDivisionPlaces: {
        select: { division: true, leagueTeam: { select: LEAGUE_TEAM_SUMMARY_SELECT } },
        orderBy: [{ division: { sort: 'asc', nulls: 'last' } }, { position: 'asc' }],
      },
    },
  });
  if (!venue) return null;
  return {
    venueId: venue.id,
    venueName: venue.name,
    divisionCount: venue.leagueDivisionCount,
    places: venue.leagueDivisionPlaces.map(place => ({ leagueTeam: toLeagueTeamSummary(place.leagueTeam), division: place.division })),
  };
}

/** The divisions as a manager saves them: how many, and each league team's place, in order */
export interface VenueDivisionsInput {
  divisionCount: number;
  places: { leagueTeamId: string; division: number | null }[];
}

// Whether the input holds together: whole numbers within bounds, each team once
function isWellFormed(input: VenueDivisionsInput): boolean {
  const { divisionCount, places } = input;
  if (!Number.isInteger(divisionCount) || divisionCount < 0 || divisionCount > LEAGUE_DIVISIONS_MAX) return false;
  if (!Array.isArray(places)) return false;
  const ids = new Set<string>();
  for (const place of places) {
    if (!place || typeof place.leagueTeamId !== 'string' || ids.has(place.leagueTeamId)) return false;
    ids.add(place.leagueTeamId);
    const { division } = place;
    if (division !== null && (!Number.isInteger(division) || division < 1 || division > divisionCount)) return false;
  }
  return true;
}

/**
 * Save a venue's divisions whole: the teams left out leave its board. A
 * league team plays in one local league: one already placed at another
 * venue is refused. Each team keeps its rank in its column.
 */
export async function saveVenueDivisions(venueId: string, input: VenueDivisionsInput): Promise<{ error: string } | VenueDivisions> {
  if (!isWellFormed(input)) return { error: ERROR.divisionsInvalid };

  const ids = input.places.map(place => place.leagueTeamId);
  const known = await prisma.leagueTeam.findMany({
    where: { id: { in: ids } },
    select: { id: true, divisionPlace: { select: { venueId: true } } },
  });
  if (known.length !== ids.length) return { error: ERROR.divisionsTeamUnknown };
  if (known.some(team => team.divisionPlace && team.divisionPlace.venueId !== venueId)) return { error: ERROR.divisionsTeamElsewhere };

  // Its rank in its column, counted as the places come
  const ranks = new Map<number | null, number>();
  const rows = input.places.map(place => {
    const position = ranks.get(place.division) ?? 0;
    ranks.set(place.division, position + 1);
    return { leagueTeamId: place.leagueTeamId, venueId, division: place.division, position };
  });

  await prisma.$transaction([
    prisma.leagueDivisionPlace.deleteMany({ where: { venueId } }),
    prisma.leagueDivisionPlace.createMany({ data: rows }),
    prisma.venue.update({ where: { id: venueId }, data: { leagueDivisionCount: input.divisionCount } }),
  ]);
  // The competitions already published go to the teams as they now stand
  await syncCompetitionOffers([venueId]);
  return (await getVenueDivisions(venueId))!;
}

// When each venue's divisions were last read from the site, so a manager
// clicking again does not read it again at once
const readAt = new Map<string, number>();

// The least time between two reads of the site for a venue
export const DIVISIONS_READ_PAUSE_MS = 5 * 60 * 1000;

/**
 * The divisions of the last month of the venue's league drawn on the site: the
 * latest month whose registration has closed, its matches telling each team's
 * division. Not saved: the board shows them for the manager to adjust and save.
 * Once every five minutes at most for a venue. Teams missing from the
 * directory are left out.
 */
export async function readVenueDivisions(venueId: string, now: Date = new Date()): Promise<{ error: string } | VenueDivisionsRead> {
  const last = readAt.get(venueId);
  if (last !== undefined && now.getTime() - last < DIVISIONS_READ_PAUSE_MS) return { error: ERROR.divisionsReadTooSoon };

  const month = await prisma.leagueTournament.findFirst({
    where: { venueId, registrationClosesAt: { lte: now } },
    orderBy: { registrationClosesAt: 'desc' },
    select: { id: true, name: true },
  });
  if (!month) return { error: ERROR.divisionsMonthUnknown };
  readAt.set(venueId, now.getTime());

  let divisions;
  try {
    divisions = await fetchLeagueMonthDivisions(month.id);
  } catch (error) {
    logger.warn(`Divisions: competitive.eva.gg could not give the divisions of ${month.id}`, error);
    return { error: ERROR.divisionsReadFailed };
  }
  if (!divisions.length) return { error: ERROR.divisionsMonthNotDrawn };

  const teams = await prisma.leagueTeam.findMany({
    where: { id: { in: divisions.flatMap(division => division.leagueTeamIds) } },
    select: LEAGUE_TEAM_SUMMARY_SELECT,
  });
  const byId = new Map(teams.map(team => [team.id, toLeagueTeamSummary(team)]));
  const places: DivisionPlace[] = divisions.flatMap(division => division.leagueTeamIds
    .map(id => byId.get(id))
    .filter(team => team !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(leagueTeam => ({ leagueTeam, division: division.number })));
  return { tournamentName: month.name, divisionCount: Math.max(...divisions.map(division => division.number)), places };
}
