// Players API client

import type { Player } from '@shared/types';
import { authFetch } from '@/api/utils';

// Cache for players - keyed by token to invalidate on user change
let cachedPlayers: Player[] | null = null;
let cachedForToken: string | null = null;

/**
 * Clear players cache (call on logout or team change)
 */
export function clearPlayersCache(): void {
  cachedPlayers = null;
  cachedForToken = null;
}

/**
 * Load all players from API (with caching)
 * Requires authentication - returns team members only
 * Cache is invalidated when token changes
 */
export async function fetchPlayers(): Promise<Player[]> {
  const currentToken = localStorage.getItem('token');

  // Invalidate cache if token changed
  if (cachedForToken !== currentToken) {
    cachedPlayers = null;
    cachedForToken = currentToken;
  }

  if (cachedPlayers) {
    return cachedPlayers;
  }

  const response = await authFetch('/api/players');
  if (!response.ok) {
    throw new Error('Failed to load players from API');
  }

  cachedPlayers = await response.json();
  return cachedPlayers!;
}

/**
 * Get cached players (must call fetchPlayers first)
 */
export function getPlayers(): Player[] {
  if (!cachedPlayers) {
    throw new Error('Players not loaded. Call fetchPlayers() first.');
  }
  return cachedPlayers;
}

/**
 * Get player by ID from cache
 */
export function getPlayerById(id: string): Player | undefined {
  return cachedPlayers?.find(p => p.id === id);
}

/**
 * Get player name by ID (with fallback)
 */
export function getPlayerName(id: string): string {
  return getPlayerById(id)?.name || id;
}


