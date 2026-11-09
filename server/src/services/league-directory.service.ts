// The directory of the league teams of competitive.eva.gg: the site's public
// list of After-H teams, read again every night, for a player to find their
// league team by its name and know it by its logo. The site cannot be searched
// by name: searches run on this copy. A logo is copied from the site the first
// time it shows, and again only when the team changes it. The venue a team
// plays its league at is read from its tournaments when it is asked for.

import { prisma } from '@db/prisma';
import { foldForSearch } from '@shared/utils/search.utils';
import { TEAM_LOGO_MAX_BYTES, type TeamLogoMimeType } from '@shared/constants/team.constants';
import { LEAGUE_SEARCH_MIN_LENGTH } from '@shared/constants/league.constants';
import type { LeagueTeamSummary, LeagueVenueProposal } from '@shared/types';
import {
  CompetitiveApiError,
  LEAGUE_TEAMS_PAGE_SIZE,
  fetchLeagueTeamLogo,
  fetchLeagueTeamTournaments,
  fetchLeagueTeamsPage,
  type LeagueTeamEntry,
  type LeagueTeamLogo,
  type LeagueTournament,
} from '../integrations/competitive/competitive-teams';
import { logger } from '../utils/logger';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// How often the server checks whether the directory is due for a read
export const LEAGUE_DIRECTORY_CHECK_INTERVAL_MS = HOUR_MS;

// Between two pages of the list: a read never comes as a burst
export const LEAGUE_DIRECTORY_PAGE_PAUSE_MS = 3000;

// The hours of the night a read happens in, Paris time, when the site is
// quietest: the first check in them reads, the next ones retry a failed read
const NIGHT_FIRST_HOUR = 4;
const NIGHT_END_HOUR = 7;

// A directory read more recently than this is not read again: one read a night
const READ_AGAIN_AFTER_MS = 20 * HOUR_MS;

// How long a team missing from the list stays. A team leaving the list while
// it is read moves the next ones back a place, and one of them can be missed
// that night: it must not lose what refers to it for that.
const MISSING_TEAM_KEPT_MS = 7 * DAY_MS;

// The most teams a read takes, four times the list as we first read it: past
// it the list is not what we know, and the read stops at its first page
const LEAGUE_DIRECTORY_MAX_TEAMS = 5000;

// The most pages a read asks for, whatever size the site makes them: a site
// giving a few teams a page never gets hundreds of calls
const LEAGUE_DIRECTORY_MAX_PAGES = Math.ceil(LEAGUE_DIRECTORY_MAX_TEAMS / LEAGUE_TEAMS_PAGE_SIZE);

// The most teams a search answers, best first
const LEAGUE_SEARCH_RESULTS = 10;

// The logos the directory shows: 128 pixels, sharp at the size of a list row
const LIST_LOGO_FORMAT = 'logo_medium';

// A logo the site failed to give is not asked for again before this
const LOGO_RETRY_AFTER_MS = 15 * 60 * 1000;

/** What a read of the list did to the directory */
export interface LeagueDirectoryReport {
  pages: number;   // Pages of the list read
  teams: number;   // Teams in the list
  skipped: number; // Entries of the list that were no team of the game
  added: number;
  changed: number; // Renamed, given a new logo or another member count
  removed: number; // Missing from the list for a week
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// The whole list, page after page, a pause between two. Each page starts where
// the one before stopped, however many teams the site gave in it.
async function readList(pauseMs: number): Promise<{ teams: Map<string, LeagueTeamEntry>; pages: number; skipped: number }> {
  const teams = new Map<string, LeagueTeamEntry>();
  let pages = 0;
  let skipped = 0;
  let offset = 0;
  let total = 0;
  do {
    if (pages === LEAGUE_DIRECTORY_MAX_PAGES) {
      throw new CompetitiveApiError(`Team list not over after ${pages} pages, at team ${offset} of ${total}`);
    }
    if (pages && pauseMs) await pause(pauseMs);
    const page = await fetchLeagueTeamsPage(offset);
    pages += 1;
    if (page.total > LEAGUE_DIRECTORY_MAX_TEAMS) {
      throw new CompetitiveApiError(`Team list holds ${page.total} teams, more than the ${LEAGUE_DIRECTORY_MAX_TEAMS} a read takes`);
    }
    total = page.total;
    skipped += page.skipped;
    for (const team of page.teams) teams.set(team.id, team);
    const read = page.teams.length + page.skipped;
    // The list ended before the total it announced
    if (!read) break;
    offset += read;
  } while (offset < total);
  return { teams, pages, skipped };
}

/**
 * Read the list again and bring the directory in line with it, in one go once
 * the whole list is read: a read that fails on the way changes nothing. A team
 * missing from the list goes after a week; a copied logo stays until the team
 * shows a new one.
 */
export async function syncLeagueDirectory(options: { now?: Date; pauseMs?: number } = {}): Promise<LeagueDirectoryReport> {
  const readAt = options.now ?? new Date();
  const { teams, pages, skipped } = await readList(options.pauseMs ?? LEAGUE_DIRECTORY_PAGE_PAUSE_MS);

  return prisma.$transaction(async tx => {
    const known = await tx.leagueTeam.findMany({ select: { id: true, name: true, memberCount: true, logoId: true } });
    const knownById = new Map(known.map(team => [team.id, team]));
    const added: LeagueTeamEntry[] = [];
    const changed: LeagueTeamEntry[] = [];
    for (const team of teams.values()) {
      const current = knownById.get(team.id);
      if (!current) added.push(team);
      else if (current.name !== team.name || current.memberCount !== team.memberCount || current.logoId !== team.logoId) changed.push(team);
    }

    if (added.length) {
      await tx.leagueTeam.createMany({
        data: added.map(team => ({ ...team, searchName: foldForSearch(team.name), seenAt: readAt })),
      });
    }
    for (const team of changed) {
      await tx.leagueTeam.update({
        where: { id: team.id },
        data: { name: team.name, searchName: foldForSearch(team.name), memberCount: team.memberCount, logoId: team.logoId },
      });
    }
    await tx.leagueTeam.updateMany({ where: { id: { in: [...teams.keys()] } }, data: { seenAt: readAt } });
    const removed = await tx.leagueTeam.deleteMany({
      where: { seenAt: { lt: new Date(readAt.getTime() - MISSING_TEAM_KEPT_MS) } },
    });

    return { pages, teams: teams.size, skipped, added: added.length, changed: changed.length, removed: removed.count };
  }, { timeout: 60_000 });
}

// The hour it is in Paris, 0 to 23
function hourInParis(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).format(date));
}

/**
 * Whether the directory is due for a read: never read (a new database), or
 * read more than 20 hours ago and it is night in Paris
 */
export async function isLeagueDirectoryDue(now: Date = new Date()): Promise<boolean> {
  const { _max: last } = await prisma.leagueTeam.aggregate({ _max: { seenAt: true } });
  if (!last.seenAt) return true;
  if (now.getTime() - last.seenAt.getTime() < READ_AGAIN_AFTER_MS) return false;
  const hour = hourInParis(now);
  return hour >= NIGHT_FIRST_HOUR && hour < NIGHT_END_HOUR;
}

let isReading = false;

/**
 * Check every hour whether the directory is due, and read it when it is. The
 * first check comes an hour after the server starts: a server restarted again
 * and again never reads the site at each start.
 */
export function startLeagueDirectorySync(): void {
  setInterval(() => {
    if (isReading) return;
    isReading = true;
    isLeagueDirectoryDue()
      .then(async due => {
        if (due) logger.info('League directory read', await syncLeagueDirectory());
      })
      .catch(error => logger.error('League directory read failed', error))
      .finally(() => {
        isReading = false;
      });
  }, LEAGUE_DIRECTORY_CHECK_INTERVAL_MS);
}

/**
 * Where the app loads a league team's logo from. The URL carries the logo's
 * id on the site, so a new logo gets a new URL and browsers never show a stale
 * cached one.
 */
export function leagueLogoUrlOf(team: { id: string; logoId: string | null }): string | null {
  return team.logoId ? `/api/league-teams/${team.id}/logo?v=${team.logoId}` : null;
}

// How well a name answers a search: the whole name, then its start, then the
// start of one of its words, then anywhere in it
function matchRank(searchName: string, wanted: string): number {
  if (searchName === wanted) return 0;
  if (searchName.startsWith(wanted)) return 1;
  if (` ${searchName}`.includes(` ${wanted}`)) return 2;
  return 3;
}

// What a summary of a league team reads from the directory
const SUMMARY_SELECT = {
  id: true,
  name: true,
  memberCount: true,
  logoId: true,
  team: { select: { id: true, name: true } },
} as const;

type SummaryRow = { id: string; name: string; memberCount: number; logoId: string | null; team: { id: string; name: string } | null };

/** A league team as the app shows it, with the team of ours linked to it */
export function toLeagueTeamSummary(row: SummaryRow): LeagueTeamSummary {
  return { id: row.id, name: row.name, memberCount: row.memberCount, logoUrl: leagueLogoUrlOf(row), team: row.team };
}

/**
 * The league teams whose name holds what the player typed, accents, case and
 * punctuation aside, best answers first. Several teams can share a name: each
 * is listed, for the player to know theirs by its logo and its member count.
 */
export async function searchLeagueTeams(query: string): Promise<LeagueTeamSummary[]> {
  const wanted = foldForSearch(query);
  if ([...wanted].length < LEAGUE_SEARCH_MIN_LENGTH) return [];

  const found = await prisma.leagueTeam.findMany({
    where: { searchName: { contains: wanted } },
    select: { ...SUMMARY_SELECT, searchName: true },
  });
  return found
    .map(team => ({ team, rank: matchRank(team.searchName, wanted) }))
    .sort((a, b) => a.rank - b.rank || a.team.name.localeCompare(b.team.name, 'fr') || a.team.id.localeCompare(b.team.id))
    .slice(0, LEAGUE_SEARCH_RESULTS)
    .map(({ team }) => toLeagueTeamSummary(team));
}

/** One league team of the directory, null when it is not there */
export async function getLeagueTeamSummary(leagueTeamId: string): Promise<LeagueTeamSummary | null> {
  const row = await prisma.leagueTeam.findUnique({ where: { id: leagueTeamId }, select: SUMMARY_SELECT });
  return row ? toLeagueTeamSummary(row) : null;
}

// The logo a team of ours takes from its league team: 256 pixels, its largest
const TEAM_LOGO_FORMAT = 'logo_large';

/**
 * A league team's logo in the size a team of ours keeps, read from the site
 * now, for a team created from it or linked to it. Null when it has none or
 * the site cannot give it: the team goes on without, its own logo to add.
 */
export async function readLeagueLogoForTeam(leagueTeamId: string): Promise<LeagueTeamLogo | null> {
  const leagueTeam = await prisma.leagueTeam.findUnique({ where: { id: leagueTeamId }, select: { logoId: true } });
  if (!leagueTeam?.logoId) return null;
  try {
    return await fetchLeagueTeamLogo(leagueTeamId, TEAM_LOGO_FORMAT, TEAM_LOGO_MAX_BYTES);
  } catch (error) {
    logger.warn(`League team ${leagueTeamId}: its logo could not be read for a team of ours`, error);
    return null;
  }
}

// How long the venue read from a league team's tournaments is kept: its league
// changes once a month at most; and how long a failed read waits to be tried again
const VENUE_PROPOSAL_KEPT_MS = DAY_MS;
const VENUE_PROPOSAL_RETRY_AFTER_MS = 15 * 60 * 1000;

// The venues read from the tournaments of league teams, by league team, and until when they hold
const venueProposals = new Map<string, { proposal: LeagueVenueProposal | null; until: number }>();

// The venue of ours a tournament is played at: its region is a venue of the local leagues,
// known by its short name (`nimes`, the address of our venue) or else by its name
function venueOfTournament(
  tournament: LeagueTournament,
  venues: { id: string; name: string; slug: string }[],
): { id: string; name: string } | null {
  const { region } = tournament;
  if (!region) return null;
  return venues.find(venue => venue.slug === region.machineName)
    ?? venues.find(venue => foldForSearch(venue.name) === foldForSearch(region.name))
    ?? null;
}

/**
 * The venue of ours a league team plays at, read from its most recent
 * tournament played at one: for a local league, the region of its tournament
 * is the venue. Null when none of its tournaments is played at one of our
 * venues, or the site cannot say; kept a day, a failure a quarter of an hour.
 */
export async function proposeLeagueTeamVenue(leagueTeamId: string): Promise<LeagueVenueProposal | null> {
  const kept = venueProposals.get(leagueTeamId);
  if (kept && kept.until > Date.now()) return kept.proposal;

  let tournaments: LeagueTournament[];
  try {
    tournaments = await fetchLeagueTeamTournaments(leagueTeamId);
  } catch (error) {
    logger.warn(`League team ${leagueTeamId}: its tournaments could not be read from competitive.eva.gg`, error);
    venueProposals.set(leagueTeamId, { proposal: null, until: Date.now() + VENUE_PROPOSAL_RETRY_AFTER_MS });
    return null;
  }

  const venues = await prisma.venue.findMany({ select: { id: true, name: true, slug: true } });
  const latestFirst = [...tournaments].sort((a, b) => (b.startsOn ?? '').localeCompare(a.startsOn ?? ''));
  let proposal: LeagueVenueProposal | null = null;
  for (const tournament of latestFirst) {
    const venue = venueOfTournament(tournament, venues);
    if (venue) {
      proposal = { venueId: venue.id, venueName: venue.name, leagueName: tournament.name };
      break;
    }
  }
  venueProposals.set(leagueTeamId, { proposal, until: Date.now() + VENUE_PROPOSAL_KEPT_MS });
  return proposal;
}

// The reads of logos under way, for two asking at once to wait for the same
const logoReads = new Map<string, Promise<LeagueTeamLogo | null>>();
// When the site last failed to give a team's logo, by team
const failedLogoReads = new Map<string, number>();

// Copy a team's logo from the site; null when the site cannot give it
async function copyLogo(teamId: string, logoId: string): Promise<LeagueTeamLogo | null> {
  try {
    const logo = await fetchLeagueTeamLogo(teamId, LIST_LOGO_FORMAT, TEAM_LOGO_MAX_BYTES);
    failedLogoReads.delete(teamId);
    // Kept only while it is still the team's logo: a read of the list may have brought a newer one meanwhile
    await prisma.leagueTeam.updateMany({
      where: { id: teamId, logoId },
      data: { logoData: new Uint8Array(logo.data), logoType: logo.type, logoCopiedId: logoId },
    });
    return logo;
  } catch (error) {
    failedLogoReads.set(teamId, Date.now());
    logger.warn(`League team ${teamId}: its logo could not be read from competitive.eva.gg`, error);
    return null;
  }
}

/**
 * A league team's logo, null when it has none or the site cannot give it. The
 * copy serves until the team shows a new logo; a logo the site failed to give
 * is not asked for again for a quarter of an hour.
 */
export async function getLeagueTeamLogo(teamId: string): Promise<LeagueTeamLogo | null> {
  const team = await prisma.leagueTeam.findUnique({
    where: { id: teamId },
    select: { logoId: true, logoData: true, logoType: true, logoCopiedId: true },
  });
  if (!team?.logoId) return null;
  if (team.logoData && team.logoType && team.logoCopiedId === team.logoId) {
    return { data: team.logoData, type: team.logoType as TeamLogoMimeType };
  }

  const failedAt = failedLogoReads.get(teamId);
  if (failedAt !== undefined && Date.now() - failedAt < LOGO_RETRY_AFTER_MS) return null;

  let read = logoReads.get(teamId);
  if (!read) {
    read = copyLogo(teamId, team.logoId).finally(() => logoReads.delete(teamId));
    logoReads.set(teamId, read);
  }
  return read;
}
