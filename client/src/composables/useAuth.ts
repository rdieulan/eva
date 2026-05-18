import { ref, computed } from 'vue';
import type { AccountPermissions, Account } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import { clearPlayersCache } from '@/api/players.api';
import { getCurrentAccount } from '@/api/auth.api';
import { clearBalanceRulesCache } from '@/composables/useBalanceRules';

// Global state
const account = ref<Account | null>(null);
const token = ref<string | null>(null);
const isLoading = ref(true);
const isInitialized = ref(false);
let initPromise: Promise<void> | null = null;
let storageListenerInitialized = false;

/**
 * Setup listener for localStorage changes from other tabs
 * Detects when another tab logs in/out or changes account
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
  account.value = null;
  clearPlayersCache();
  clearBalanceRulesCache();
}

// Clear authentication
function clearAuth() {
  clearAuthState();
  localStorage.removeItem('token');
  localStorage.removeItem('account');
}

// Set account after login
function setAuth(newToken: string, newAccount: Account) {
  token.value = newToken;
  account.value = newAccount;
  isInitialized.value = true;
  isLoading.value = false;
  localStorage.setItem('token', newToken);
  localStorage.setItem('account', JSON.stringify(newAccount));
}

// Refresh account data from server (after team join, permission changes, etc.)
async function refreshAccount(): Promise<void> {
  const currentToken = token.value || localStorage.getItem('token');
  if (!currentToken) return;

  try {
    const refreshedAccount = await getCurrentAccount();
    account.value = refreshedAccount;
    localStorage.setItem('account', JSON.stringify(refreshedAccount));
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
    const validatedAccount = await getCurrentAccount();
    token.value = storedToken;
    account.value = validatedAccount;
    localStorage.setItem('account', JSON.stringify(validatedAccount));
  } catch {
    // Token invalid or server error
    clearAuth();
  }

  isLoading.value = false;
  isInitialized.value = true;
}

// Get account permissions (with fallback to default)
const permissions = computed<AccountPermissions>(() => {
  return account.value?.permissions ?? DEFAULT_PLAYER_PERMISSIONS;
});

// Exported composable
export function useAuth() {
  const isAuthenticated = computed(() => !!(token.value && account.value));
  const isLeader = computed(() => account.value?.isLeader ?? false);
  const hasTeam = computed(() => !!account.value?.teamId);

  return {
    // State
    account: computed(() => account.value),
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
    refreshAccount,
  };
}
