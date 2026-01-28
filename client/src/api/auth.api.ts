// Authentication API client

import type { UserPermissions } from '@shared/types';
import { ERROR_MESSAGES } from '@shared/constants';
import { authFetch } from '@/api/utils';
import { ApiError } from '@/api/error';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  permissions: UserPermissions;
  teamId: string | null;
  isLeader: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

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
    const data = await response.json();
    throw new Error(data.errors?.join('. ') || ERROR_MESSAGES.loginFailed);
  }

  return response.json();
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  await authFetch('/api/auth/logout', { method: 'POST' });
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const response = await authFetch('/api/auth/me');

  if (!response.ok) {
    throw new Error(ERROR_MESSAGES.unauthorized);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Change password
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const response = await authFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw ApiError.fromResponse(data, ERROR_MESSAGES.passwordChangeFailed);
  }
}

