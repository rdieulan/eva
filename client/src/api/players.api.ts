// Players API client

import type { Player } from '@shared/types';

// Cache for players (loaded once)
let cachedPlayers: Player[] | null = null;

/**
 * Load all players from API (with caching)
 */
export async function fetchPlayers(): Promise<Player[]> {
  if (cachedPlayers) {
    return cachedPlayers;
  }

  const response = await fetch('/api/players');
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

/**
 * Clear player cache (for testing or refresh)
 */
export function clearPlayersCache(): void {
  cachedPlayers = null;
}

