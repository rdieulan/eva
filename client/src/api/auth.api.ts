// Authentication API client: signing in with Discord, the session, the role it
// acts as, the name a person shows, the invitations to a role

import type { Account, AccountType, DevLoginAccount, InvitationSummary, LoginResponse } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

/**
 * The address that starts signing in with Discord: the browser goes there, off
 * to Discord's page, and comes back to `next` signed in (or to the invitation
 * page, when accepting `invitation` fails)
 */
export function discordSignInUrl({ next, invitation }: { next?: string; invitation?: string } = {}): string {
  const query = new URLSearchParams({
    ...(next && next !== '/' && { next }),
    ...(invitation && { invitation }),
  }).toString();
  return `/api/auth/discord${query ? `?${query}` : ''}`;
}

/**
 * The account of this browser's session, null when it holds none. Signed out
 * is an answer here, not a failure: no redirect to the login page.
 */
export async function fetchSessionAccount(): Promise<Account | null> {
  const response = await fetch('/api/auth/session');
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, ERROR.serverError);
  }
  const { account } = (await response.json()) as { account: Account | null };
  return account;
}

/**
 * Logout current account
 */
export async function logout(): Promise<void> {
  await authFetch('/api/auth/logout', { method: 'POST' });
}

/**
 * Get current account info
 */
export async function getCurrentAccount(): Promise<Account> {
  const response = await authFetch<{ account: Account }>('/api/auth/me', undefined, ERROR.unauthorized);
  return response.account;
}

/**
 * Act as another role of the account (player, venue manager, admin), in this session
 */
export async function switchRole(role: AccountType): Promise<Account> {
  const response = await authFetch<LoginResponse>(
    '/api/auth/role',
    { method: 'PUT', body: JSON.stringify({ role }) },
    ERROR.roleSwitchFailed,
  );
  return response.account;
}

/**
 * Change the name the person shows the others
 */
export async function renameAccount(name: string): Promise<Account> {
  const response = await authFetch<LoginResponse>(
    '/api/auth/name',
    { method: 'PUT', body: JSON.stringify({ name }) },
    ERROR.nameUpdateFailed,
  );
  return response.account;
}

/**
 * The first-login walk-through is over, done or skipped: it no longer shows
 */
export async function finishOnboarding(): Promise<Account> {
  const response = await authFetch<LoginResponse>('/api/auth/onboarding', { method: 'POST' }, ERROR.onboardingFailed);
  return response.account;
}

/**
 * An invitation to a role, as its link shows it; null when the link leads
 * nowhere (unknown, or already used). Read before signing in.
 */
export async function fetchInvitation(token: string): Promise<InvitationSummary | null> {
  const response = await fetch(`/api/auth/invitations/${encodeURIComponent(token)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, ERROR.invitationFetchFailed);
  }
  return (await response.json()) as InvitationSummary;
}

/**
 * The accounts the development login offers (development only)
 */
export async function fetchDevLoginAccounts(): Promise<DevLoginAccount[]> {
  const response = await fetch('/api/auth/dev/accounts');
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, ERROR.devLoginFailed);
  }
  return (await response.json()) as DevLoginAccount[];
}

/**
 * Act as an account of the local database, without Discord (development only)
 */
export async function devLogin(userId: string): Promise<Account> {
  const response = await fetch('/api/auth/dev/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    throw await ApiError.fromFailedResponse(response, ERROR.devLoginFailed);
  }
  return ((await response.json()) as LoginResponse).account;
}
