<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import TopBar from '@/components/layout/TopBar.vue';
import { useAuth } from '@/composables/useAuth';

const { isAuthenticated, user, isLoading, initAuth } = useAuth();

const route = useRoute();

// Initialize auth on mount
onMounted(async () => {
  await initAuth();
});

// User name for the TopBar
const userName = computed(() => user.value?.name);

// Determine if TopBar should be displayed (not on login page)
const showTopBar = computed(() => route.name !== 'login');
</script>

<template>
  <div class="app">
    <!-- Loading state while checking auth -->
    <div v-if="isLoading" class="loading-screen">
      <div class="spinner"></div>
    </div>

    <template v-else>
      <!-- Global TopBar with dynamic section -->
      <TopBar
        v-if="showTopBar"
        :isAuthenticated="isAuthenticated"
        :userName="userName"
      >
        <!-- Dynamic content will be injected by each page via teleport -->
        <div id="topbar-dynamic-content" class="dynamic-content"></div>
      </TopBar>

      <!-- Page content -->
      <main class="page-content" :class="{ 'no-topbar': !showTopBar }">
        <RouterView />
      </main>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: $color-bg-primary;
  overflow: hidden;
}

.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: $color-bg-primary;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid $color-border;
  border-top-color: #4ecdc4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

  &.no-topbar {
    height: 100vh;
  }
}
</style>
