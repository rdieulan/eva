<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = defineProps<{
  isAuthenticated?: boolean;
  userName?: string;
}>();

const router = useRouter();

function goToHome() {
  router.push('/');
}

function goToLogin() {
  router.push('/login');
}

function goToProfile() {
  router.push('/profile');
}
</script>

<template>
  <header class="top-bar">
    <!-- Section Logo - tout à gauche (immuable) -->
    <div class="section-logo">
      <button class="btn-home" @click="goToHome" title="Retour à l'accueil">
        <svg viewBox="0 0 24 24" class="home-icon">
          <!-- Placeholder icon - house -->
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </button>
    </div>

    <!-- Section centrale - Dynamique (slot) -->
    <div class="section-dynamic">
      <slot></slot>
    </div>

    <!-- Section Login/Profile - tout à droite (immuable) -->
    <div class="section-auth">
      <template v-if="isAuthenticated">
        <button class="btn-profile" @click="goToProfile">
          <svg viewBox="0 0 24 24" class="profile-icon">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>{{ userName || 'Profil' }}</span>
        </button>
      </template>
      <template v-else>
        <button class="btn-login" @click="goToLogin">
          <svg viewBox="0 0 24 24" class="login-icon">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>Login</span>
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: stretch;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
  min-height: 70px;
}

/* Section Logo - immuable */
.section-logo {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-right: 1px solid #333;
}

.btn-home {
  width: 48px;
  height: 48px;
  border: none;
  background: #2a2a4a;
  border-radius: 8px;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-home:hover {
  background: #3a3a5a;
  transform: scale(1.05);
}

.home-icon {
  width: 100%;
  height: 100%;
  fill: #7a7aba;
}

.btn-home:hover .home-icon {
  fill: #9a9ada;
}

/* Section Dynamique - via slot */
.section-dynamic {
  flex: 1;
  display: flex;
  align-items: stretch;
}

/* Section Auth - immuable */
.section-auth {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-left: 1px solid #333;
}

.btn-login,
.btn-profile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 2px solid #4a4a8a;
  background: transparent;
  color: #9a9ada;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-login:hover,
.btn-profile:hover {
  background: #2a2a4a;
  border-color: #7a7aba;
  color: #fff;
}

.btn-profile {
  border-color: #4ade80;
  color: #4ade80;
}

.btn-profile:hover {
  border-color: #6ee7a0;
  color: #fff;
  background: rgba(74, 222, 128, 0.1);
}

.login-icon,
.profile-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}
</style>

