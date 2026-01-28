// Maps API client

import type { MapConfig } from '@shared/types';
import { ERROR_MESSAGES } from '@shared/constants';
import { authFetch } from '@/api/utils';

/**
 * Fetch all maps (requires authentication - returns team maps only)
 */
export async function fetchAllMaps(): Promise<MapConfig[]> {
  return authFetch<MapConfig[]>('/api/maps', undefined, ERROR_MESSAGES.mapsLoadFailed);
}

/**
 * Fetch a single map by ID (requires authentication)
 */
export async function fetchMap(mapId: string): Promise<MapConfig> {
  return authFetch<MapConfig>(`/api/maps/${mapId}`, undefined, ERROR_MESSAGES.mapLoadFailed);
}

/**
 * Save map configuration (admin only)
 */
export async function saveMap(
  mapId: string,
  mapData: { name?: string; images?: string[]; template?: object }
): Promise<{ success: boolean; message: string }> {
  return authFetch<{ success: boolean; message: string }>(
    `/api/maps/${mapId}`,
    { method: 'POST', body: JSON.stringify(mapData) },
    ERROR_MESSAGES.mapSaveFailed
  );
}

/**
 * Fetch game plans for a map (requires authentication)
 */
export async function fetchGamePlans(mapId: string): Promise<{ id: string; name: string }[]> {
  return authFetch<{ id: string; name: string }[]>(
    `/api/maps/${mapId}/plans`,
    undefined,
    ERROR_MESSAGES.plansLoadFailed
  );
}

/**
 * Fetch a specific game plan (requires authentication)
 */
export async function fetchGamePlan(planId: string): Promise<MapConfig & { planId: string; planName: string }> {
  return authFetch<MapConfig & { planId: string; planName: string }>(
    `/api/plans/${planId}`,
    undefined,
    ERROR_MESSAGES.planLoadFailed
  );
}

/**
 * Save game plan (admin only)
 */
export async function saveGamePlan(
  planId: string,
  planData: { name?: string; assignments?: object[]; players?: object[]; notes?: object }
): Promise<{ success: boolean }> {
  return authFetch<{ success: boolean }>(
    `/api/plans/${planId}`,
    { method: 'PUT', body: JSON.stringify(planData) },
    ERROR_MESSAGES.planSaveFailed
  );
}

/**
 * Create a new game plan (admin only)
 */
export async function createGamePlan(
  mapId: string,
  name: string
): Promise<{ id: string; name: string }> {
  return authFetch<{ id: string; name: string }>(
    `/api/maps/${mapId}/plans`,
    { method: 'POST', body: JSON.stringify({ name }) },
    ERROR_MESSAGES.planCreationFailed
  );
}

/**
 * Delete a game plan (admin only)
 */
export async function deleteGamePlan(planId: string): Promise<void> {
  return authFetch<void>(
    `/api/plans/${planId}`,
    { method: 'DELETE' },
    ERROR_MESSAGES.planDeletionFailed
  );
}
