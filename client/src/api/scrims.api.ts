// Scrim searches API client

import type {
  CalendarEvent,
  ScrimProposal,
  ScrimSearch,
  CreateScrimProposalRequest,
  CreateScrimSearchRequest,
  UpdateScrimSearchRequest,
} from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

const API_BASE = '/api/scrims/searches';

/**
 * The open searches of a month (YYYY-MM): the reader's team's wherever they
 * are, and every other team's offering slots in one of the venues when some
 * are given
 */
export async function fetchScrimSearches(month: string, venueIds?: string[] | null): Promise<ScrimSearch[]> {
  const params = new URLSearchParams({ month });
  if (venueIds) params.set('venueIds', venueIds.join(','));
  return authFetch<ScrimSearch[]>(`${API_BASE}?${params}`, undefined, ERROR.scrimSearchesFetchFailed);
}

/**
 * Put slots of one venue or more up for an opponent, for a day
 */
export async function createScrimSearch(body: CreateScrimSearchRequest): Promise<ScrimSearch> {
  return authFetch<ScrimSearch>(
    API_BASE,
    { method: 'POST', body: JSON.stringify(body) },
    ERROR.scrimSearchCreateFailed,
  );
}

/**
 * Change one of the team's open searches: its slots, the length of a match,
 * how many it wants; the day stays
 */
export async function updateScrimSearch(id: string, body: UpdateScrimSearchRequest): Promise<ScrimSearch> {
  return authFetch<ScrimSearch>(
    `${API_BASE}/${id}`,
    { method: 'PUT', body: JSON.stringify(body) },
    ERROR.scrimSearchUpdateFailed,
  );
}

/**
 * Answer another team's search
 */
export async function createScrimProposal(searchId: string, body: CreateScrimProposalRequest): Promise<ScrimProposal> {
  return authFetch<ScrimProposal>(
    `${API_BASE}/${searchId}/proposals`,
    { method: 'POST', body: JSON.stringify(body) },
    ERROR.scrimProposalCreateFailed,
  );
}

/**
 * Take a proposal on one of the team's searches: the match lands in both calendars
 */
export async function acceptScrimProposal(proposalId: string): Promise<{ proposal: ScrimProposal; events: CalendarEvent[] }> {
  return authFetch<{ proposal: ScrimProposal; events: CalendarEvent[] }>(
    `/api/scrims/proposals/${proposalId}/accept`,
    { method: 'PUT' },
    ERROR.scrimProposalRespondFailed,
  );
}

/**
 * Turn a proposal down; the search stays open
 */
export async function declineScrimProposal(proposalId: string): Promise<ScrimProposal> {
  return authFetch<ScrimProposal>(
    `/api/scrims/proposals/${proposalId}/decline`,
    { method: 'PUT' },
    ERROR.scrimProposalRespondFailed,
  );
}

/**
 * Take back one of the team's pending proposals
 */
export async function withdrawScrimProposal(proposalId: string): Promise<void> {
  const response = await authFetch(`/api/scrims/proposals/${proposalId}`, { method: 'DELETE' });
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, ERROR.scrimProposalWithdrawFailed);
  }
}

/**
 * Withdraw one of the team's open searches
 */
export async function deleteScrimSearch(id: string): Promise<void> {
  // Answers 204 with no body, so the JSON-parsing form of authFetch does not apply
  const response = await authFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, ERROR.scrimSearchDeleteFailed);
  }
}
