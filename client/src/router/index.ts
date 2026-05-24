import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import type { Account } from '@shared/types';
import { useAuth } from '@/composables/useAuth';

// Pages allowed without team membership
const ALLOWED_WITHOUT_TEAM = [
  'home',
  'profile',
  'team',
  'create-team',
  'join-team',
  'login',
  'register',
  'activate',
  'reset-password',
  'admin',
  'admin-venues',
  'admin-managers',
  'admin-admins',
  'admin-players',
  'admin-teams',
] as const;

// Routes only meaningful for player accounts (admin/manager have no team)
const PLAYER_ONLY_ROUTES = [
  'home',
  'planner',
  'calendar',
  'team',
  'create-team',
  'join-team',
] as const;

/**
 * Default landing page based on the account's role.
 * - admin → /admin/venues
 * - manager → /profile (no manager dashboard yet)
 * - player → /
 */
export function landingPathForAccount(account: Account | null): string {
  if (!account) return '/login';
  if (account.adminId) return '/admin/venues';
  if (account.managerId) return '/profile';
  return '/';
}

// Lazy loading des pages
const HomePage = () => import('@/pages/HomePage.vue');
const PlannerPage = () => import('@/pages/PlannerPage.vue');
const CalendarPage = () => import('@/pages/CalendarPage.vue');
const ProfilePage = () => import('@/pages/ProfilePage.vue');
const TeamPage = () => import('@/pages/TeamPage.vue');
const CreateTeamPage = () => import('@/pages/CreateTeamPage.vue');
const JoinTeamPage = () => import('@/pages/JoinTeamPage.vue');
const LoginPage = () => import('@/pages/LoginPage.vue');
const RegisterPage = () => import('@/pages/RegisterPage.vue');
const ActivatePage = () => import('@/pages/ActivatePage.vue');
const ResetPasswordPage = () => import('@/pages/ResetPasswordPage.vue');
const AdminLayout = () => import('@/pages/AdminLayout.vue');
const AdminVenuesPage = () => import('@/pages/AdminVenuesPage.vue');
const AdminManagersPage = () => import('@/pages/AdminManagersPage.vue');
const AdminAdminsPage = () => import('@/pages/AdminAdminsPage.vue');
const AdminPlayersPage = () => import('@/pages/AdminPlayersPage.vue');
const AdminTeamsPage = () => import('@/pages/AdminTeamsPage.vue');

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
    meta: { title: 'Accueil', requiresAuth: true }
  },
  {
    path: '/planner',
    name: 'planner',
    component: PlannerPage,
    meta: { title: 'Planificateur', requiresAuth: true }
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: CalendarPage,
    meta: { title: 'Calendrier', requiresAuth: true }
  },
  {
    path: '/team/create',
    name: 'create-team',
    component: CreateTeamPage,
    meta: { title: 'Créer une équipe', requiresAuth: true }
  },
  {
    path: '/team',
    name: 'team',
    component: TeamPage,
    meta: { title: 'Mon équipe', requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    meta: { title: 'Profil', requiresAuth: true }
  },
  {
    path: '/join/:code',
    name: 'join-team',
    component: JoinTeamPage,
    meta: { title: 'Rejoindre une équipe', requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { title: 'Connexion', requiresAuth: false }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterPage,
    meta: { title: 'Inscription', requiresAuth: false }
  },
  {
    path: '/activate/:token',
    name: 'activate',
    component: ActivatePage,
    meta: { title: 'Activer le compte', requiresAuth: false }
  },
  {
    path: '/reset-password/:token',
    name: 'reset-password',
    component: ResetPasswordPage,
    meta: { title: 'Réinitialiser le mot de passe', requiresAuth: false }
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminLayout,
    meta: { title: 'Administration', requiresAuth: true, requiresAdmin: true },
    redirect: { name: 'admin-venues' },
    children: [
      {
        path: 'venues',
        name: 'admin-venues',
        component: AdminVenuesPage,
        meta: { title: 'Administration · Salles', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'managers',
        name: 'admin-managers',
        component: AdminManagersPage,
        meta: { title: 'Administration · Managers', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'admins',
        name: 'admin-admins',
        component: AdminAdminsPage,
        meta: { title: 'Administration · Administrateurs', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'players',
        name: 'admin-players',
        component: AdminPlayersPage,
        meta: { title: 'Administration · Joueurs', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'teams',
        name: 'admin-teams',
        component: AdminTeamsPage,
        meta: { title: 'Administration · Équipes', requiresAuth: true, requiresAdmin: true },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Garde de navigation
router.beforeEach(async (to, _from, next) => {
  // Update page title
  document.title = `EVA - ${to.meta.title || 'App'}`;

  const { isAuthenticated, isLoading, initAuth, hasTeam, account } = useAuth();

  // Wait for auth to be initialized
  if (isLoading.value) {
    await initAuth();
  }

  // If already authenticated and trying to access login/register page, redirect
  if ((to.name === 'login' || to.name === 'register') && isAuthenticated.value) {
    const redirect = to.query.redirect as string;
    next(redirect || landingPathForAccount(account.value));
    return;
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  // Admin-only routes
  if (to.meta.requiresAdmin && !account.value?.adminId) {
    next(landingPathForAccount(account.value));
    return;
  }

  // Admin / manager trying to access a player-only route → bounce to their landing page
  if (
    isAuthenticated.value
    && (account.value?.adminId || account.value?.managerId)
    && PLAYER_ONLY_ROUTES.includes(to.name as typeof PLAYER_ONLY_ROUTES[number])
  ) {
    next(landingPathForAccount(account.value));
    return;
  }

  // If authenticated but no team, redirect to home (except allowed pages)
  if (isAuthenticated.value && !hasTeam.value && !ALLOWED_WITHOUT_TEAM.includes(to.name as typeof ALLOWED_WITHOUT_TEAM[number])) {
    next({ name: 'home' });
    return;
  }

  next();
});

export default router;
