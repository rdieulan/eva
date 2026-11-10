// The league teams of competitive.eva.gg, read from the site's public API
//
// competitive.eva.gg is where eva.gg runs its leagues, a site of the Toornament
// platform. Its public list of the After-H teams gives each team's name, its
// number of members and its logo, without a token; it cannot be searched by
// name. What we know of it and the rules for calling it: docs/COMPETITIVE_API.md.
//
// No path aliases in this directory: the scripts under scripts/ load these
// files with tsx, which does not resolve them.

import { detectImageType } from '../../../../shared/utils/image.utils';
import { cleanForeignName } from '../../../../shared/utils/validation.utils';
import type { TeamLogoMimeType } from '../../../../shared/constants/team.constants';

const COMPETITIVE_URL = 'https://competitive.eva.gg';

// The game of the leagues, as the site names it
const DISCIPLINE = 'after_humanity';

// How long the site has to answer each call
const ANSWER_TIMEOUT_MS = 15_000;

// The most teams the list gives in one answer
export const LEAGUE_TEAMS_PAGE_SIZE = 50;

// An id on the site: a long number, written as digits
const SITE_ID = /^\d{1,24}$/;

// The longest name kept, in characters: the site's own are far shorter
const NAME_MAX_LENGTH = 80;

/** A league team as the list gives it */
export interface LeagueTeamEntry {
  id: string;
  name: string;
  memberCount: number;
  logoId: string | null; // A new id with each new logo; null when the team has none
}

/** One answer of the list: its teams, and how many the whole list holds */
export interface LeagueTeamsPage {
  teams: LeagueTeamEntry[];
  skipped: number; // Entries left out for not reading as a team of the game
  total: number;
}

/** The sizes the site serves a team's logo in: 64, 128 and 256 pixels */
export type LeagueLogoFormat = 'logo_small' | 'logo_medium' | 'logo_large';

/** A team's logo, checked to be an image of a kind a logo can be */
export interface LeagueTeamLogo {
  data: Uint8Array;
  type: TeamLogoMimeType;
}

/** The site refused or failed a call, or answered something unreadable */
export class CompetitiveApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'CompetitiveApiError';
    this.status = status;
  }
}

async function call(path: string, headers: Record<string, string>): Promise<Response> {
  try {
    return await fetch(`${COMPETITIVE_URL}${path}`, { headers, signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS) });
  } catch (error) {
    throw new CompetitiveApiError(`No answer from competitive.eva.gg: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// An entry of the list as we keep it, or null when it is not a team of the
// game: its name made fit to show, a member count it always has
function readTeam(item: unknown): LeagueTeamEntry | null {
  if (!item || typeof item !== 'object') return null;
  const { id, name, discipline, memberCount, logo } = item as Record<string, unknown>;
  if (typeof id !== 'string' || !SITE_ID.test(id) || discipline !== DISCIPLINE) return null;

  const cleaned = typeof name === 'string' ? cleanForeignName(name) : '';
  if (!cleaned) return null;

  const logoId = logo && typeof logo === 'object' ? (logo as Record<string, unknown>).id : null;
  return {
    id,
    name: [...cleaned].slice(0, NAME_MAX_LENGTH).join('').trimEnd(),
    memberCount: typeof memberCount === 'number' && Number.isInteger(memberCount) && memberCount >= 0 ? memberCount : 0,
    logoId: typeof logoId === 'string' && SITE_ID.test(logoId) ? logoId : null,
  };
}

/**
 * The teams of the list from `offset` on, `size` at most, oldest first. The
 * site pages its lists with `offset` and `limit` in the address, the way its
 * own pages ask for them; an answer from another place in the list than the
 * one asked for is refused, so a change of how the site pages never passes
 * for a list of its first teams only.
 */
export async function fetchLeagueTeamsPage(offset: number, size = LEAGUE_TEAMS_PAGE_SIZE): Promise<LeagueTeamsPage> {
  const response = await call(`/api/teams?discipline=${DISCIPLINE}&offset=${offset}&limit=${size}`, {
    accept: 'application/json',
  });
  if (!response.ok) throw new CompetitiveApiError(`Team list refused: HTTP ${response.status}`, response.status);

  const body = await response.json().catch(() => null) as { items?: unknown; range?: { offset?: unknown; total?: unknown } } | null;
  const total = body?.range?.total;
  if (!body || !Array.isArray(body.items) || typeof total !== 'number' || !Number.isInteger(total)) {
    throw new CompetitiveApiError('Team list unreadable', response.status);
  }
  if (body.range?.offset !== offset) {
    throw new CompetitiveApiError(`Team list answered from ${String(body.range?.offset)} when asked from ${offset}`, response.status);
  }

  const teams = body.items.map(readTeam).filter((team): team is LeagueTeamEntry => team !== null);
  return { teams, skipped: body.items.length - teams.length, total };
}

/** Where the registration of a tournament stands: not open yet, open, or over */
export type RegistrationStatus = 'pending' | 'open' | 'finished';

const REGISTRATION_STATUSES: readonly string[] = ['pending', 'open', 'finished'];

/**
 * A tournament of the site's leagues. A local league is a region of the "LOCAL
 * LEAGUES" circuit, one region per venue, its short name the venue's (`nimes`);
 * the tournament's own place is left empty. Each month of a league is a
 * tournament of its own, with its own registration.
 */
export interface LeagueTournament {
  id: string;
  name: string;
  startsOn: string | null; // YYYY-MM-DD
  region: { id: string; name: string; machineName: string } | null;
  registration: {
    status: RegistrationStatus | null;
    opensAt: string | null;  // ISO date-time
    closesAt: string | null; // ISO date-time
  };
}

// The most recent tournaments of a team read: its current league is among them
const TEAM_TOURNAMENTS_READ = 10;

// The most recent tournaments of a league read: this month's and the next one's
const LEAGUE_TOURNAMENTS_READ = 3;

// A date-time as the site writes it (2026-11-29T23:00:00+00:00), or null
function readDateTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

// An entry of a tournament list as we use it, or null when it reads as none
function readTournament(item: unknown): LeagueTournament | null {
  if (!item || typeof item !== 'object') return null;
  const {
    id, name, scheduledDateStart, circuitRegion,
    registrationStatus, registrationOpeningDatetime, registrationClosingDatetime,
  } = item as Record<string, unknown>;
  if (typeof id !== 'string' || !SITE_ID.test(id)) return null;
  const cleaned = typeof name === 'string' ? cleanForeignName(name) : '';
  if (!cleaned) return null;

  const region = circuitRegion && typeof circuitRegion === 'object' ? circuitRegion as Record<string, unknown> : null;
  return {
    id,
    name: [...cleaned].slice(0, NAME_MAX_LENGTH).join('').trimEnd(),
    startsOn: typeof scheduledDateStart === 'string' && /^\d{4}-\d{2}-\d{2}/.test(scheduledDateStart) ? scheduledDateStart.slice(0, 10) : null,
    region: region && typeof region.id === 'string' && SITE_ID.test(region.id) && typeof region.name === 'string' && typeof region.machineName === 'string'
      ? { id: region.id, name: region.name, machineName: region.machineName }
      : null,
    registration: {
      status: typeof registrationStatus === 'string' && REGISTRATION_STATUSES.includes(registrationStatus)
        ? registrationStatus as RegistrationStatus
        : null,
      opensAt: readDateTime(registrationOpeningDatetime),
      closesAt: readDateTime(registrationClosingDatetime),
    },
  };
}

// The `limit` latest tournaments the filter names, latest first
async function fetchTournaments(filter: string, limit: number): Promise<LeagueTournament[]> {
  const response = await call(`/api/tournaments?${filter}&sort=scheduled_desc&offset=0&limit=${limit}`, { accept: 'application/json' });
  if (!response.ok) throw new CompetitiveApiError(`Tournament list refused: HTTP ${response.status}`, response.status);

  const body = await response.json().catch(() => null) as { items?: unknown } | null;
  if (!body || !Array.isArray(body.items)) throw new CompetitiveApiError('Tournament list unreadable', response.status);
  return body.items.map(readTournament).filter((tournament): tournament is LeagueTournament => tournament !== null);
}

/**
 * The most recent tournaments a league team plays or played, latest first. A
 * team is listed in a tournament once registered to it: a tournament missing
 * here is one the team is not registered to.
 */
export async function fetchLeagueTeamTournaments(teamId: string): Promise<LeagueTournament[]> {
  if (!SITE_ID.test(teamId)) throw new CompetitiveApiError(`Not a team id: ${teamId}`);
  return fetchTournaments(`team_id=${teamId}`, TEAM_TOURNAMENTS_READ);
}

/** A division of a month of a league, as its matches tell it: its number, its name, and its league teams */
export interface LeagueMonthDivision {
  number: number; // 1 is the top division
  name: string;   // "Division 2"
  leagueTeamIds: string[];
}

// A page of the matches of a month: 3 divisions of 4 play 18
const MONTH_MATCHES_PAGE_SIZE = 50;
// The pages of a month read at most: a league far larger than any seen stops there
const MONTH_MATCHES_PAGES_MAX = 4;

/**
 * The divisions of a month of a league, read from its matches: each match
 * belongs to a group, which is a division ("Division 2"), and each of its
 * opponents names the league team it is. Empty while the month is not drawn:
 * its matches only exist once its registration has closed.
 */
export async function fetchLeagueMonthDivisions(tournamentId: string): Promise<LeagueMonthDivision[]> {
  if (!SITE_ID.test(tournamentId)) throw new CompetitiveApiError(`Not a tournament id: ${tournamentId}`);
  const divisions = new Map<number, { name: string; leagueTeamIds: Set<string> }>();
  let offset = 0;
  for (let page = 0; page < MONTH_MATCHES_PAGES_MAX; page += 1) {
    const response = await call(
      `/api/matches?tournament_ids=${tournamentId}&sort=structure&offset=${offset}&limit=${MONTH_MATCHES_PAGE_SIZE}`,
      { accept: 'application/json' },
    );
    if (!response.ok) throw new CompetitiveApiError(`Match list refused: HTTP ${response.status}`, response.status);
    const body = await response.json().catch(() => null) as { items?: unknown; range?: { total?: unknown } } | null;
    const total = body?.range?.total;
    if (!body || !Array.isArray(body.items) || typeof total !== 'number') {
      throw new CompetitiveApiError('Match list unreadable', response.status);
    }

    for (const item of body.items) {
      const match = item && typeof item === 'object' ? item as Record<string, unknown> : null;
      const group = match?.group && typeof match.group === 'object' ? match.group as Record<string, unknown> : null;
      if (!group || typeof group.number !== 'number' || !Number.isInteger(group.number) || group.number < 1) continue;
      const name = typeof group.name === 'string' && cleanForeignName(group.name) ? cleanForeignName(group.name) : `Division ${group.number}`;
      const division = divisions.get(group.number) ?? { name, leagueTeamIds: new Set<string>() };
      divisions.set(group.number, division);
      for (const opponent of Array.isArray(match!.opponents) ? match!.opponents : []) {
        const participant = opponent && typeof opponent === 'object' ? (opponent as Record<string, unknown>).participant : null;
        const team = participant && typeof participant === 'object' ? (participant as Record<string, unknown>).team : null;
        const id = team && typeof team === 'object' ? (team as Record<string, unknown>).id : null;
        if (typeof id === 'string' && SITE_ID.test(id)) division.leagueTeamIds.add(id);
      }
    }

    offset += body.items.length;
    if (!body.items.length || offset >= total) break;
  }

  return [...divisions.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, division]) => ({ number, name: division.name, leagueTeamIds: [...division.leagueTeamIds] }));
}

/** The most recent tournaments of a league (a region of a circuit), latest first */
export async function fetchLeagueRegionTournaments(regionId: string): Promise<LeagueTournament[]> {
  if (!SITE_ID.test(regionId)) throw new CompetitiveApiError(`Not a region id: ${regionId}`);
  return fetchTournaments(`circuit_region_ids=${regionId}`, LEAGUE_TOURNAMENTS_READ);
}

// The whole body of an answer, refused past `maxBytes`, whatever size it claims
async function readAtMost(response: Response, maxBytes: number): Promise<Uint8Array> {
  const tooLarge = () => new CompetitiveApiError(`Logo larger than ${maxBytes} bytes`, response.status);
  if (Number(response.headers.get('content-length')) > maxBytes) throw tooLarge();

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }

  const data = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    data.set(chunk, at);
    at += chunk.length;
  }
  return data;
}

/**
 * A team's logo in one of the site's sizes, refused past `maxBytes` and unless
 * it really is a PNG, JPEG or WebP image, whatever the site declares
 */
export async function fetchLeagueTeamLogo(teamId: string, format: LeagueLogoFormat, maxBytes: number): Promise<LeagueTeamLogo> {
  if (!SITE_ID.test(teamId)) throw new CompetitiveApiError(`Not a team id: ${teamId}`);

  const response = await call(`/api/teams/${teamId}/logo/${format}`, { accept: 'image/png, image/jpeg, image/webp' });
  if (!response.ok) throw new CompetitiveApiError(`Logo refused: HTTP ${response.status}`, response.status);
  // The site may hand the image over to another address: only ever an encrypted one
  if (response.url && new URL(response.url).protocol !== 'https:') {
    throw new CompetitiveApiError('Logo served over an unencrypted address', response.status);
  }

  const data = await readAtMost(response, maxBytes);
  const type = detectImageType(data);
  if (!type) throw new CompetitiveApiError('Logo is not a PNG, JPEG or WebP image', response.status);
  return { data, type };
}
