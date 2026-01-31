// Authentication API client

import type { Account, LoginResponse, LoginCredentials } from '@shared/types';
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

