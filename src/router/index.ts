import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuth } from '../composables/useAuth';

// Lazy loading des pages
const HomePage = () => import('../pages/HomePage.vue');
const PlannerPage = () => import('../pages/PlannerPage.vue');
const CalendarPage = () => import('../pages/CalendarPage.vue');
const ProfilePage = () => import('../pages/ProfilePage.vue');
const LoginPage = () => import('../pages/LoginPage.vue');

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
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    meta: { title: 'Profil', requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { title: 'Connexion', requiresAuth: false }
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

  const { isAuthenticated, isLoading, initAuth } = useAuth();

  // Wait for auth to be initialized
  if (isLoading.value) {
    await initAuth();
  }

  // If already authenticated and trying to access login page, redirect
  if (to.name === 'login' && isAuthenticated.value) {
    const redirect = to.query.redirect as string;
    next(redirect || { name: 'home' });
    return;
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next({ name: 'login', query: { redirect: to.fullPath } });
  } else {
    next();
  }
});

export default router;
