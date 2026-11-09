// API utilities

import { ApiError } from '@/api/error';
import { unmarkSession } from '@/api/session-mark';
import { ERROR } from '@shared/constants';

// Flag to prevent multiple simultaneous logout redirects
let isLoggingOut = false;

/**
 * Handle 401 unauthorized errors globally: the session ended, back to the login page
 */
function handleUnauthorized(): void {
  if (isLoggingOut) return;
  isLoggingOut = true;

  unmarkSession();
  window.location.href = '/login';
}

// The session itself is a cookie, sent by the browser with every request to the API
const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

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
      ...JSON_HEADERS,
      ...options.headers,
    },
  });

  // Handle 401 Unauthorized globally
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error(ERROR.sessionExpired);
  }

  // If errorMessage provided, handle errors and return JSON
  if (errorMessage !== undefined) {
    if (!response.ok) {
      throw await ApiError.fromFailedResponse(response, errorMessage);
    }
    try {
      return (await response.json()) as T;
    } catch {
      // A success without a readable body is not an answer: the caller gets
      // its own failure message, not a JSON parsing error
      throw new ApiError([], errorMessage);
    }
  }

  return response;
}
