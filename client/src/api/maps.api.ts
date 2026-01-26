// Maps API client

import type { MapConfig } from '@shared/types';
import { authFetch } from '@/api/utils';

/**
 * Fetch all maps (requires authentication - returns team maps only)
 */
export async function fetchAllMaps(): Promise<MapConfig[]> {
  const response = await authFetch('/api/maps');
  if (!response.ok) {
    throw new Error('Failed to load maps from API');
  }
  return response.json();
}

/**
 * Fetch a single map by ID (requires authentication)
 */
export async function fetchMap(mapId: string): Promise<MapConfig> {
  const response = await authFetch(`/api/maps/${mapId}`);
  if (!response.ok) {
    throw new Error(`Failed to load map: ${mapId}`);
  }
  return response.json();
}

/**
 * Save map configuration (admin only)
 */
export async function saveMap(
  mapId: string,
  data: { name?: string; images?: string[]; template?: object }
): Promise<{ success: boolean; message: string }> {
  const response = await authFetch(`/api/maps/${mapId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.json();
}

/**
 * Fetch game plans for a map (requires authentication)
 */
export async function fetchGamePlans(mapId: string): Promise<{ id: string; name: string }[]> {
  const response = await authFetch(`/api/maps/${mapId}/plans`);
  if (!response.ok) {
    throw new Error(`Failed to load game plans for map: ${mapId}`);
  }
  return response.json();
}

/**
 * Fetch a specific game plan (requires authentication)
 */
export async function fetchGamePlan(planId: string): Promise<MapConfig & { planId: string; planName: string }> {
  const response = await authFetch(`/api/plans/${planId}`);
  if (!response.ok) {
    throw new Error(`Failed to load game plan: ${planId}`);
  }
  return response.json();
}

/**
 * Save game plan (admin only)
 */
export async function saveGamePlan(
  planId: string,
  data: { name?: string; assignments?: object[]; players?: object[]; notes?: object }
): Promise<{ success: boolean }> {
  const response = await authFetch(`/api/plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to save game plan');
  }

  return response.json();
}

/**
 * Create a new game plan (admin only)
 */
export async function createGamePlan(
  mapId: string,
  name: string
): Promise<{ id: string; name: string }> {
  const response = await authFetch(`/api/maps/${mapId}/plans`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to create game plan');
  }

  return response.json();
}

/**
 * Delete a game plan (admin only)
 */
export async function deleteGamePlan(planId: string): Promise<void> {
  const response = await authFetch(`/api/plans/${planId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete game plan');
  }
}

