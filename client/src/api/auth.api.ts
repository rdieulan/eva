// Authentication API client

import type { Account, LoginResponse, LoginCredentials, LinkedAccount } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

/**
 * Login with email and password
 * Note: Does not use authFetch because no token exists yet
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw ApiError.fromResponse(errorData, ERROR.loginFailed);
  }

  return response.json();
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
 * Change password
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await authFetch<void>(
    '/api/auth/change-password',
    { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
    ERROR.passwordChangeFailed
  );
}

/**
 * Activate manager account with password
 * Note: Does not use authFetch because no token exists yet
 */
export async function activateAccount(activationToken: string, password: string): Promise<void> {
  const response = await fetch('/api/auth/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: activationToken, password }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw ApiError.fromResponse(errorData, ERROR.activationFailed);
  }
}

/**
 * Link current account to another account
 */
export async function linkAccount(email: string, password: string): Promise<{ groupId: string }> {
  return authFetch<{ groupId: string }>(
    '/api/auth/link-account',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    ERROR.linkAccountFailed
  );
}

/**
 * Get all linked accounts for current user
 */
export async function getLinkedAccounts(): Promise<LinkedAccount[]> {
  return authFetch<LinkedAccount[]>('/api/auth/linked-accounts', undefined, ERROR.serverError);
}

/**
 * Switch to another linked account
 */
export async function switchAccount(targetAccountId: string): Promise<LoginResponse> {
  return authFetch<LoginResponse>(
    '/api/auth/switch-account',
    { method: 'POST', body: JSON.stringify({ targetAccountId }) },
    ERROR.switchAccountFailed
  );
}
