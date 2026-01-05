import { ref, computed } from 'vue';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'PLAYER';
}

export interface Permissions {
  canEdit: boolean;
  canManageUsers: boolean;
  canExportPlans: boolean;
  canViewPlanner: boolean;
  canViewCalendar: boolean;
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

// Role-based permissions
const permissions = computed<Permissions>(() => {
  const role = user.value?.role;

  return {
    canEdit: role === 'ADMIN',
    canManageUsers: role === 'ADMIN',
    canExportPlans: role === 'ADMIN' || role === 'PLAYER',
    canViewPlanner: role === 'ADMIN' || role === 'PLAYER',
    canViewCalendar: role === 'ADMIN' || role === 'PLAYER',
  };
});

// Exported composable
export function useAuth() {
  const isAuthenticated = computed(() => !!(token.value && user.value));
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isPlayer = computed(() => user.value?.role === 'PLAYER');

  return {
    // State
    user: computed(() => user.value),
    token: computed(() => token.value),
    isAuthenticated,
    isAdmin,
    isPlayer,
    isLoading: computed(() => isLoading.value),
    permissions,

    // Actions
    setAuth,
    clearAuth,
    initAuth,
  };
}

