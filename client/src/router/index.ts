import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { PLANNER_ENABLED } from '@shared/constants';
import { useAuth } from '@/composables/useAuth';
import { landingPathForAccount, needsWalkThrough } from '@/utils/landing';

// Pages allowed without team membership
const ALLOWED_WITHOUT_TEAM = [
  'welcome',
  'home',
  'profile',
  'manager',
  'team',
  'create-team',
  'join-team',
  'login',
  'activate',
  'venue-board',
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

export { landingPathForAccount };

// Lazy loading des pages
const HomePage = () => import('@/pages/HomePage.vue');
const PlannerPage = () => import('@/pages/PlannerPage.vue');
const CalendarPage = () => import('@/pages/CalendarPage.vue');
const ProfilePage = () => import('@/pages/ProfilePage.vue');
const ManagerPage = () => import('@/pages/ManagerPage.vue');
const TeamPage = () => import('@/pages/TeamPage.vue');
const CreateTeamPage = () => import('@/pages/CreateTeamPage.vue');
const JoinTeamPage = () => import('@/pages/JoinTeamPage.vue');
const LoginPage = () => import('@/pages/LoginPage.vue');
const WelcomePage = () => import('@/pages/WelcomePage.vue');
const ActivatePage = () => import('@/pages/ActivatePage.vue');
const VenueBoardPage = () => import('@/pages/VenueBoardPage.vue');
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
  // The planner is parked for now (see PLANNER_ENABLED); its address sends back home
  ...(PLANNER_ENABLED
    ? [{
        path: '/planner',
        name: 'planner',
        component: PlannerPage,
        meta: { title: 'Planificateur', requiresAuth: true },
      }]
    : [{ path: '/planner', redirect: '/' }]),
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
    // The space of a venue manager, for the venues they manage
    path: '/gestion',
    name: 'manager',
    component: ManagerPage,
    meta: { title: 'Espace gérant', requiresAuth: true, requiresManager: true }
  },
  {
    path: '/join/:code',
    name: 'join-team',
    component: JoinTeamPage,
    meta: { title: 'Rejoindre une équipe', requiresAuth: true }
  },
  {
    // The first-login walk-through: pseudo, eva.gg account, EVA Pass, team
    path: '/bienvenue',
    name: 'welcome',
    component: WelcomePage,
    meta: { title: 'Bienvenue', requiresAuth: true, hideTopBar: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { title: 'Connexion', requiresAuth: false, hideTopBar: true }
  },
  {
    // An invitation to a role (venue manager, admin), accepted by signing in with Discord
    path: '/activate/:token',
    name: 'activate',
    component: ActivatePage,
    meta: { title: 'Invitation', requiresAuth: false }
  },
  {
    // A venue's board, shared on its own channels: anyone reads it, signed in or not,
    // and signing in from it comes back to it
    path: '/salles/:slug',
    name: 'venue-board',
    component: VenueBoardPage,
    meta: { title: 'Scrims', requiresAuth: false, returnAfterLogin: true }
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

  // If already authenticated and trying to access the login page, redirect
  if (to.name === 'login' && isAuthenticated.value) {
    const redirect = to.query.redirect as string;
    next(redirect || landingPathForAccount(account.value));
    return;
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  // A player goes through the walk-through first, then on where they were going
  if (to.meta.requiresAuth && to.name !== 'welcome' && needsWalkThrough(account.value)) {
    next({ name: 'welcome', query: to.fullPath === '/' ? {} : { next: to.fullPath } });
    return;
  }

  // The manager's space, for a session acting as a venue manager
  if (to.meta.requiresManager && !account.value?.managerId) {
    next(landingPathForAccount(account.value));
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
