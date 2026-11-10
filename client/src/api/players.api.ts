// Players API client

import type { Player, PlayerSubscription, EvaAccountLink, LinkEvaAccountRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { currentSessionMark } from '@/api/session-mark';

// Cache for players - keyed by session to invalidate on a change of account or role
let cachedPlayers: Player[] | null = null;
let cachedForSession: string | null = null;

/**
 * Clear players cache (call on logout or team change)
 */
export function clearPlayersCache(): void {
  cachedPlayers = null;
  cachedForSession = null;
}

/**
 * Load all players from API (with caching)
 * Requires authentication - returns team members only
 * Cache is invalidated when the account or its role changes
 */
export async function fetchPlayers(): Promise<Player[]> {
  const session = currentSessionMark();

  // Invalidate cache if the account or its role changed
  if (cachedForSession !== session) {
    cachedPlayers = null;
    cachedForSession = session;
  }

  if (cachedPlayers) {
    return cachedPlayers;
  }

  cachedPlayers = await authFetch<Player[]>('/api/players', undefined, ERROR.playersLoadFailed);
  return cachedPlayers;
}

/**
 * Get cached players (must call fetchPlayers first)
 */
export function getPlayers(): Player[] {
  if (!cachedPlayers) {
    throw new Error(ERROR.playersNotLoaded);
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
 * Get the subscription the current player entered in their profile
 */
export function fetchMySubscription(): Promise<PlayerSubscription> {
  return authFetch<PlayerSubscription>('/api/players/me/subscription', undefined, ERROR.subscriptionFetchFailed);
}

/**
 * Replace the current player's subscription (null clears a field)
 */
export function updateMySubscription(subscription: PlayerSubscription): Promise<PlayerSubscription> {
  return authFetch<PlayerSubscription>(
    '/api/players/me/subscription',
    { method: 'PUT', body: JSON.stringify(subscription) },
    ERROR.subscriptionUpdateFailed,
  );
}

/**
 * The eva.gg account the current player linked (null if none)
 */
export function fetchMyEvaAccount(): Promise<EvaAccountLink | null> {
  return authFetch<EvaAccountLink | null>('/api/players/me/eva-account', undefined, ERROR.evaAccountFetchFailed);
}

/**
 * Link the current player to the eva.gg account behind a tag (Pseudo#123456),
 * in place of the one linked before: a player changes it, never goes without one
 */
export function linkMyEvaAccount(username: string): Promise<EvaAccountLink> {
  const body: LinkEvaAccountRequest = { username };
  return authFetch<EvaAccountLink>(
    '/api/players/me/eva-account',
    { method: 'PUT', body: JSON.stringify(body) },
    ERROR.evaAccountLinkFailed,
  );
}

