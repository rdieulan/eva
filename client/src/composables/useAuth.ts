import { ref, computed } from 'vue';
import type { AccountPermissions, Account } from '@shared/types';
import { normalizeAccountPermissions } from '@shared/utils';
import { clearPlayersCache } from '@/api/players.api';
import { fetchSessionAccount, getCurrentAccount } from '@/api/auth.api';
import { markSession, onSessionMarkChange, sessionMarkOf, unmarkSession } from '@/api/session-mark';
import { clearBalanceRulesCache } from '@/composables/useBalanceRules';

// Global state. The session is a cookie the page cannot read: the account the
// server answers for is what says who is signed in.
const account = ref<Account | null>(null);
const isLoading = ref(true);
const isInitialized = ref(false);
let initPromise: Promise<void> | null = null;
let markListenerInitialized = false;

/**
 * Follow the other tabs: a logout there signs this one out, a login or a
 * switch of account or role reloads it as the session now acts
 */
function setupMarkListener(): void {
  if (markListenerInitialized) return;
  markListenerInitialized = true;

  onSessionMarkChange(mark => {
    const currentMark = account.value ? sessionMarkOf(account.value) : null;

    if (!mark && currentMark) {
      clearAuthState();
      window.location.href = '/login';
      return;
    }

    if (mark && mark !== currentMark) {
      window.location.reload();
    }
  });
}

// Clear authentication state (internal, the mark stays)
function clearAuthState() {
  account.value = null;
  clearPlayersCache();
  clearBalanceRulesCache();
}

// Clear authentication, after a logout
function clearAuth() {
  clearAuthState();
  unmarkSession();
}

// Set the account a login or a switch of role made the session act as
function setAuth(newAccount: Account) {
  account.value = newAccount;
  isInitialized.value = true;
  isLoading.value = false;
  markSession(newAccount);
}

// Refresh account data from server (after team join, permission changes, etc.)
async function refreshAccount(): Promise<void> {
  if (!account.value) return;

  try {
    account.value = await getCurrentAccount();
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
  setupMarkListener();

  // Asked on every load: a sign-in with Discord comes back through a
  // redirect, and the server answers "nobody" without refusing anything
  try {
    const sessionAccount = await fetchSessionAccount();
    account.value = sessionAccount;
    if (sessionAccount) {
      markSession(sessionAccount);
    } else {
      // No session, or it ended (logout elsewhere, expired): the mark goes with it
      unmarkSession();
    }
  } catch {
    // The server did not answer: signed out for now, the mark stays for the next load
  }

  isLoading.value = false;
  isInitialized.value = true;
}

// The account's permissions, read against the full set: a category the
// account never had reads as nothing granted
const permissions = computed<AccountPermissions>(() => normalizeAccountPermissions(account.value?.permissions));

// Exported composable
export function useAuth() {
  const isAuthenticated = computed(() => !!account.value);
  const isLeader = computed(() => account.value?.isLeader ?? false);
  const hasTeam = computed(() => !!account.value?.teamId);

  return {
    // State
    account: computed(() => account.value),
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
