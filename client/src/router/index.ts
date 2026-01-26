import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

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
    meta: { title: 'Rejoindre une équipe', requiresAuth: false }
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

  // Pages allowed without team: home, profile, team (for creation), join-team
  const allowedWithoutTeam = ['home', 'profile', 'team', 'create-team', 'join-team', 'login', 'register'];

  // If authenticated but no team, redirect to home (except allowed pages)
  if (isAuthenticated.value && !hasTeam.value && !allowedWithoutTeam.includes(to.name as string)) {
    next({ name: 'home' });
    return;
  }

  next();
});

export default router;
