// Players API client

import type { Player, PlayerSubscription, EvaAccountLink, LinkEvaAccountRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { markedAccountId } from '@/api/session-mark';
import { ApiError } from '@/api/error';

// Cache for players - keyed by account to invalidate on account change
let cachedPlayers: Player[] | null = null;
let cachedForAccountId: string | null = null;

/**
 * Clear players cache (call on logout or team change)
 */
export function clearPlayersCache(): void {
  cachedPlayers = null;
  cachedForAccountId = null;
}

/**
 * Load all players from API (with caching)
 * Requires authentication - returns team members only
 * Cache is invalidated when the account changes
 */
export async function fetchPlayers(): Promise<Player[]> {
  const currentAccountId = markedAccountId();

  // Invalidate cache if the account changed
  if (cachedForAccountId !== currentAccountId) {
    cachedPlayers = null;
    cachedForAccountId = currentAccountId;
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
 * Link the current player to the eva.gg account behind a tag (Pseudo#123456)
 */
export function linkMyEvaAccount(username: string): Promise<EvaAccountLink> {
  const body: LinkEvaAccountRequest = { username };
  return authFetch<EvaAccountLink>(
    '/api/players/me/eva-account',
    { method: 'PUT', body: JSON.stringify(body) },
    ERROR.evaAccountLinkFailed,
  );
}

/**
 * Forget the current player's eva.gg account
 */
export async function unlinkMyEvaAccount(): Promise<void> {
  // Answers 204 with no body, so the JSON-parsing form of authFetch does not apply
  const response = await authFetch('/api/players/me/eva-account', { method: 'DELETE' });
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, ERROR.evaAccountUnlinkFailed);
  }
}
