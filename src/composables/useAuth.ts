import { ref, computed } from 'vue';

// Types
export interface User {
  id: string;
  email: string;
  nom: string;
  role: 'ADMIN' | 'PLAYER';
}

export interface Permissions {
  canEdit: boolean;
  canManageUsers: boolean;
  canExportPlans: boolean;
  canViewPlanner: boolean;
  canViewCalendar: boolean;
}

// État global de l'utilisateur
const user = ref<User | null>(null);
const token = ref<string | null>(null);

// Initialiser depuis le localStorage
function initAuth() {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (storedToken && storedUser) {
    try {
      token.value = storedToken;
      user.value = JSON.parse(storedUser);
    } catch {
      clearAuth();
    }
  }
}

// Nettoyer l'authentification
function clearAuth() {
  token.value = null;
  user.value = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Définir l'utilisateur après login
function setAuth(newToken: string, newUser: User) {
  token.value = newToken;
  user.value = newUser;
  localStorage.setItem('token', newToken);
  localStorage.setItem('user', JSON.stringify(newUser));
}

// Permissions basées sur le rôle
const permissions = computed<Permissions>(() => {
  const role = user.value?.role;

  return {
    // Seuls les admins peuvent éditer
    canEdit: role === 'ADMIN',
    // Seuls les admins peuvent gérer les utilisateurs
    canManageUsers: role === 'ADMIN',
    // Tout le monde peut exporter
    canExportPlans: role === 'ADMIN' || role === 'PLAYER',
    // Tout le monde peut voir le planner
    canViewPlanner: role === 'ADMIN' || role === 'PLAYER',
    // Tout le monde peut voir le calendrier
    canViewCalendar: role === 'ADMIN' || role === 'PLAYER',
  };
});

// Composable exporté
export function useAuth() {
  // Initialiser au premier appel
  if (!user.value && !token.value) {
    initAuth();
  }

  const isAuthenticated = computed(() => !!(token.value && user.value));
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isPlayer = computed(() => user.value?.role === 'PLAYER');

  return {
    // État
    user: computed(() => user.value),
    token: computed(() => token.value),
    isAuthenticated,
    isAdmin,
    isPlayer,
    permissions,

    // Actions
    setAuth,
    clearAuth,
    initAuth,
  };
}

