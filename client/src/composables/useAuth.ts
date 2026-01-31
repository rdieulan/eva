import { ref, computed } from 'vue';
import type { AccountPermissions, Account } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import { clearPlayersCache } from '@/api/players.api';
import { getCurrentUser } from '@/api/auth.api';
import { clearBalanceRulesCache } from '@/composables/useBalanceRules';

// Global state
const user = ref<Account | null>(null);
const token = ref<string | null>(null);
const isLoading = ref(true);
const isInitialized = ref(false);
let initPromise: Promise<void> | null = null;
let storageListenerInitialized = false;

/**
 * Setup listener for localStorage changes from other tabs
 * Detects when another tab logs in/out or changes user
 */
function setupStorageListener(): void {
  if (storageListenerInitialized) return;
  storageListenerInitialized = true;

  window.addEventListener('storage', (event) => {
    // Only react to token changes
    if (event.key !== 'token') return;

    const currentToken = token.value;
    const newToken = event.newValue;

    // Another tab logged out
    if (!newToken && currentToken) {
      clearAuthState();
      window.location.href = '/login';
      return;
    }

    // Another tab logged in with a different account
    if (newToken && newToken !== currentToken) {
      // Reload the page to sync with the new session
      window.location.reload();
    }
  });
}

// Clear authentication state (internal, without localStorage removal)
function clearAuthState() {
  token.value = null;
  user.value = null;
  clearPlayersCache();
  clearBalanceRulesCache();
}

// Clear authentication
function clearAuth() {
  clearAuthState();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Set user after login
function setAuth(newToken: string, newUser: Account) {
  token.value = newToken;
  user.value = newUser;
  isInitialized.value = true;
  isLoading.value = false;
  localStorage.setItem('token', newToken);
  localStorage.setItem('user', JSON.stringify(newUser));
}

// Refresh user data from server (after team join, permission changes, etc.)
async function refreshUser(): Promise<void> {
  const currentToken = token.value || localStorage.getItem('token');
  if (!currentToken) return;

  try {
    const refreshedUser = await getCurrentUser();
    user.value = refreshedUser;
    localStorage.setItem('user', JSON.stringify(refreshedUser));
    // Clear caches as team data may have changed
    clearPlayersCache();
    clearBalanceRulesCache();
  } catch {
    // Ignore errors, keep current state
  }
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

  // Setup cross-tab session sync
  setupStorageListener();

  const storedToken = localStorage.getItem('token');

  if (!storedToken) {
    isLoading.value = false;
    isInitialized.value = true;
    return;
  }

  // Validate token with server
  try {

    const validatedUser = await getCurrentUser();
    token.value = storedToken;
    user.value = validatedUser;
    localStorage.setItem('user', JSON.stringify(validatedUser));
  } catch {
    // Token invalid or server error
    clearAuth();
  }

  isLoading.value = false;
  isInitialized.value = true;
}

// Get user permissions (with fallback to default)
const permissions = computed<AccountPermissions>(() => {
  return user.value?.permissions ?? DEFAULT_PLAYER_PERMISSIONS;
});

// Exported composable
export function useAuth() {
  const isAuthenticated = computed(() => !!(token.value && user.value));
  const isLeader = computed(() => user.value?.isLeader ?? false);
  const hasTeam = computed(() => !!user.value?.teamId);

  return {
    // State
    user: computed(() => user.value),
    token: computed(() => token.value),
    isAuthenticated,
    isLeader,
    hasTeam,
    isLoading: computed(() => isLoading.value),
    permissions,

    // Actions
    setAuth,
    clearAuth,
    initAuth,
    refreshUser,
  };
}
