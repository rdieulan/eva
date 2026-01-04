<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from './components/layout/TopBar.vue';
import { useAuth } from './composables/useAuth';

const { isAuthenticated, user, initAuth } = useAuth();

const route = useRoute();

// Vérifier l'authentification à chaque changement de route
watch(() => route.path, () => {
  initAuth();
}, { immediate: true });

// Nom de l'utilisateur pour la TopBar
const userName = computed(() => user.value?.nom);

// Détermine si on doit afficher la TopBar (pas sur la page login)
const showTopBar = computed(() => route.name !== 'login');
</script>

<template>
  <div class="app">
    <!-- TopBar globale avec section dynamique -->
    <TopBar
      v-if="showTopBar"
      :isAuthenticated="isAuthenticated"
      :userName="userName"
    >
      <!-- Le contenu dynamique sera injecté par chaque page via teleport -->
      <div id="topbar-dynamic-content" class="dynamic-content"></div>
    </TopBar>

    <!-- Contenu des pages -->
    <main class="page-content" :class="{ 'no-topbar': !showTopBar }">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #0f0f1a;
  overflow: hidden;
}

.dynamic-content {
  display: flex;
  flex: 1;
  align-items: stretch;
  width: 100%;
}

.page-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.page-content.no-topbar {
  height: 100vh;
}
</style>
