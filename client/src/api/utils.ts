// API utilities

import { ApiError } from '@/api/error';
import { ERROR_MESSAGES } from '@shared/constants';

// Flag to prevent multiple simultaneous logout redirects
let isLoggingOut = false;

/**
 * Handle 401 unauthorized errors globally
 * Clears auth state and redirects to login
 */
function handleUnauthorized(): void {
  if (isLoggingOut) return;
  isLoggingOut = true;

  // Clear auth data from localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  // Redirect to login
  window.location.href = '/login';
}

/**
 * Get authentication headers for API calls
 */
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Authenticated fetch wrapper
 * - Without errorMessage: returns raw Response (caller handles errors)
 * - With errorMessage: returns parsed JSON and throws ApiError on failure
 */
export async function authFetch(
  url: string,
  options?: RequestInit
): Promise<Response>;
export async function authFetch<T>(
  url: string,
  options: RequestInit | undefined,
  errorMessage: string
): Promise<T>;
export async function authFetch<T>(
  url: string,
  options: RequestInit = {},
  errorMessage?: string
): Promise<Response | T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  // Handle 401 Unauthorized globally
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error(ERROR_MESSAGES.sessionExpired);
  }

  // If errorMessage provided, handle errors and return JSON
  if (errorMessage !== undefined) {
    if (!response.ok) {
      const errorData = await response.json();
      throw ApiError.fromResponse(errorData, errorMessage);
    }
    return (await response.json()) as T;
  }

  return response;
}
