// League teams API client: the directory of the teams of competitive.eva.gg

import type { LeagueTeamSummary, LeagueVenueProposal } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';

const API_BASE = '/api/league-teams';

/**
 * The league teams whose name answers what the player typed, best first. A
 * search typed over can be called off with `signal`.
 */
export async function searchLeagueTeams(query: string, signal?: AbortSignal): Promise<LeagueTeamSummary[]> {
  const { teams } = await authFetch<{ teams: LeagueTeamSummary[] }>(
    `${API_BASE}?${new URLSearchParams({ q: query }).toString()}`,
    { signal },
    ERROR.leagueSearchFailed,
  );
  return teams;
}

/**
 * The venue of ours a league team plays its local league at, as its
 * tournaments on the site tell it; null when none of them is at one of ours
 */
export async function fetchLeagueVenueProposal(leagueTeamId: string): Promise<LeagueVenueProposal | null> {
  const { proposal } = await authFetch<{ proposal: LeagueVenueProposal | null }>(
    `${API_BASE}/${encodeURIComponent(leagueTeamId)}/venue`,
    undefined,
    ERROR.serverError,
  );
  return proposal;
}

/** One league team of the directory, as a search lists it */
export async function fetchLeagueTeam(leagueTeamId: string): Promise<LeagueTeamSummary> {
  return authFetch<LeagueTeamSummary>(`${API_BASE}/${encodeURIComponent(leagueTeamId)}`, undefined, ERROR.leagueTeamNotFound);
}
