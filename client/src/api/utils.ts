// API utilities

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
 * Automatically handles 401 errors by forcing logout
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
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
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  return response;
}

