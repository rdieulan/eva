// Scrim searches API client

import type { ScrimSearch, CreateScrimSearchRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

const API_BASE = '/api/scrims/searches';

/**
 * The open searches of a month (YYYY-MM): every team's at a venue when one is
 * given, the reader's team's everywhere otherwise
 */
export async function fetchScrimSearches(month: string, venueId?: string | null): Promise<ScrimSearch[]> {
  const params = new URLSearchParams({ month });
  if (venueId) params.set('venueId', venueId);
  return authFetch<ScrimSearch[]>(`${API_BASE}?${params}`, undefined, ERROR.scrimSearchesFetchFailed);
}

/**
 * Put a run of a venue's slots up for an opponent
 */
export async function createScrimSearch(body: CreateScrimSearchRequest): Promise<ScrimSearch> {
  return authFetch<ScrimSearch>(
    API_BASE,
    { method: 'POST', body: JSON.stringify(body) },
    ERROR.scrimSearchCreateFailed,
  );
}

/**
 * Withdraw one of the team's open searches
 */
export async function deleteScrimSearch(id: string): Promise<void> {
  // Answers 204 with no body, so the JSON-parsing form of authFetch does not apply
  const response = await authFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw ApiError.fromResponse(await response.json(), ERROR.scrimSearchDeleteFailed);
  }
}
