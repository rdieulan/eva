import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

// Pages allowed without team membership
const ALLOWED_WITHOUT_TEAM = ['home', 'profile', 'team', 'create-team', 'join-team', 'login', 'register', 'activate'] as const;

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
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Garde de navigation
router.beforeEach(async (to, _from, next) => {
  // Update page title
  document.title = `EVA - ${to.meta.title || 'App'}`;

  const { isAuthenticated, isLoading, initAuth, hasTeam } = useAuth();

  // Wait for auth to be initialized
  if (isLoading.value) {
    await initAuth();
  }

  // If already authenticated and trying to access login/register page, redirect
  if ((to.name === 'login' || to.name === 'register') && isAuthenticated.value) {
    const redirect = to.query.redirect as string;
    next(redirect || { name: 'home' });
    return;
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next({ name: 'login', query: { redirect: to.fullPath } });
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
