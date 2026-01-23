import { ref, computed } from 'vue';
import type { UserPermissions } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  permissions: UserPermissions;
  teamId: string | null;
  isLeader: boolean;
}

// Global state
const user = ref<User | null>(null);
const token = ref<string | null>(null);
const isLoading = ref(true);
const isInitialized = ref(false);
let initPromise: Promise<void> | null = null;

// Clear authentication
function clearAuth() {
  token.value = null;
  user.value = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Set user after login
function setAuth(newToken: string, newUser: User) {
  token.value = newToken;
  user.value = newUser;
  isInitialized.value = true;
  isLoading.value = false;
  localStorage.setItem('token', newToken);
  localStorage.setItem('user', JSON.stringify(newUser));
}

// Initialize and validate auth
function initAuth(): Promise<void> {
  // Return existing promise if already initializing
  if (initPromise) return initPromise;

  // Already done
  if (isInitialized.value) {
    return Promise.resolve();
  }

  initPromise = doInitAuth();
  return initPromise;
}

async function doInitAuth(): Promise<void> {
  isLoading.value = true;

  const storedToken = localStorage.getItem('token');

  if (!storedToken) {
    isLoading.value = false;
    isInitialized.value = true;
    return;
  }

  // Validate token with server
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${storedToken}` }
    });

    if (response.ok) {
      const data = await response.json();
      token.value = storedToken;
      user.value = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      // Token invalid
      clearAuth();
    }
  } catch {
    // Server error
    clearAuth();
  }

  isLoading.value = false;
  isInitialized.value = true;
}

// Get user permissions (with fallback to default)
const permissions = computed<UserPermissions>(() => {
  return user.value?.permissions ?? DEFAULT_PLAYER_PERMISSIONS;
});

// Exported composable
export function useAuth() {
  const isAuthenticated = computed(() => !!(token.value && user.value));
  const isLeader = computed(() => user.value?.isLeader ?? false);

  return {
    // State
    user: computed(() => user.value),
    token: computed(() => token.value),
    isAuthenticated,
    isLeader,
    isLoading: computed(() => isLoading.value),
    permissions,

    // Actions
    setAuth,
    clearAuth,
    initAuth,
  };
}
