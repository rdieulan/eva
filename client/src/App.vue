<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import DynamicTopBar from '@/components/common/layout/DynamicTopBar.vue';
import AppNavTabs from '@/components/common/layout/AppNavTabs.vue';
import { useAuth } from '@/composables/useAuth';
import { useBalanceRules } from '@/composables/useBalanceRules';
import { useTeamLogo } from '@/composables/useTeamLogo';

const { isAuthenticated, account, isLoading, initAuth } = useAuth();
const { fetchRules } = useBalanceRules();
const { teamLogoUrl, load: loadTeamLogo, clear: clearTeamLogo } = useTeamLogo();

const route = useRoute();

// Initialize auth on mount
onMounted(async () => {
  await initAuth();
});

// Load balance rules when authenticated
watch(isAuthenticated, async (authenticated) => {
  if (authenticated) {
    await fetchRules();
  }
}, { immediate: true });

// The team logo in the top bar follows the team of the signed-in player
watch(() => account.value?.teamId ?? null, async (teamId) => {
  if (teamId) {
    await loadTeamLogo();
  } else {
    clearTeamLogo();
  }
}, { immediate: true });

// Account name for the TopBar
const userName = computed(() => account.value?.name);

// A player in a team has the bell, which tells the team what happened, and the tabs between its pages
const isTeamPlayer = computed(() => account.value?.accountType === 'player' && !!account.value.teamId);

// The tabs between the team's pages, for a player in a team
const showNav = computed(() => isTeamPlayer.value);

// The TopBar hides on the pages that stand alone (signing in, the first-login walk-through)
const showTopBar = computed(() => !route.meta.hideTopBar);

// The tabs between the team's pages, at the foot of the screen on a phone
const showBottomNav = computed(() => showTopBar.value && showNav.value);
</script>

<template>
  <div class="app" :class="{ 'has-bottom-nav': showBottomNav }">
    <!-- Loading state while checking auth -->
    <div v-if="isLoading" class="loading-screen">
      <div class="spinner"></div>
    </div>

    <template v-else>
      <!-- Global TopBar with dynamic section -->
      <DynamicTopBar
        v-if="showTopBar"
        :isAuthenticated="isAuthenticated"
        :userName="userName"
        :teamLogoUrl="teamLogoUrl"
        :showNotifications="isTeamPlayer"
        :showNav="showNav"
      >
        <!-- Dynamic content will be injected by each page via teleport -->
        <div id="topbar-dynamic-content" class="dynamic-content"></div>
      </DynamicTopBar>

      <!-- Page content -->
      <main class="page-content" :class="{ 'no-topbar': !showTopBar }">
        <RouterView />
      </main>

      <!-- On a phone, the tabs between the team's pages sit at the foot of the screen -->
      <AppNavTabs v-if="showBottomNav" placement="bottom" :team-logo-url="teamLogoUrl" />
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
  background: $texture-bg $color-bg-primary;
  overflow: hidden;

  // What the tabs take at the foot of a phone's screen: whatever is fixed to the
  // bottom of the screen (a selection bar, a drawer) stands above them by this much
  --app-bottom-inset: 0px;

  &.has-bottom-nav {
    @include mobile-lg {
      --app-bottom-inset: calc(#{$bottom-nav-height} + #{$border-thin} + env(safe-area-inset-bottom));
    }
  }
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
  border-top-color: $color-accent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dynamic-content {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
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
