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
