<script setup lang="ts">
// The way between the pages of the role the session acts as, always at hand:
// for a player, the home dashboard, and in a team its calendar and its page;
// for a venue manager, the tabs of their space. Each role keeps to its own
// pages: the top bar switches roles (see RoleSwitch). In the top bar on a
// wide screen; at the foot of a phone's screen, within reach of the thumb.
// The page in sight is marked.
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { PLANNER_ENABLED } from '@shared/constants';
import { useAuth } from '@/composables/useAuth';
import SvgIcon from '@/components/common/SvgIcon.vue';

const props = defineProps<{
  placement: 'top' | 'bottom';
  teamLogoUrl: string | null; // The team's tab shows its logo when it has one
}>();

const route = useRoute();
const { account } = useAuth();

type TabIcon = 'home' | 'calendar' | 'notes' | 'users' | 'trophy';

interface Tab {
  to: string;
  label: string;
  icon: TabIcon;
  isCurrent: boolean;
}

// The tabs of the manager's space, in their order
const MANAGER_TABS: { to: string; label: string; icon: TabIcon }[] = [
  { to: '/gestion/competition', label: 'Compétition', icon: 'trophy' },
];

const tabs = computed<Tab[]>(() => {
  if (account.value?.accountType === 'manager') {
    return MANAGER_TABS.map(tab => ({ ...tab, isCurrent: route.path.startsWith(tab.to) }));
  }
  const isPlayer = account.value?.accountType === 'player';
  const inTeam = isPlayer && !!account.value?.teamId;
  return [
    ...(isPlayer ? [{ to: '/', label: 'Accueil', icon: 'home' as const, isCurrent: route.path === '/' }] : []),
    ...(inTeam ? [{ to: '/calendar', label: 'Calendrier', icon: 'calendar' as const, isCurrent: route.path.startsWith('/calendar') }] : []),
    ...(inTeam && PLANNER_ENABLED
      ? [{ to: '/planner', label: 'Planificateur', icon: 'notes' as const, isCurrent: route.path.startsWith('/planner') }]
      : []),
    ...(inTeam ? [{ to: '/team', label: 'Équipe', icon: 'users' as const, isCurrent: route.path.startsWith('/team') }] : []),
  ];
});
</script>

<template>
  <nav class="nav-tabs" :class="`nav-tabs--${props.placement}`" aria-label="Pages de l'app">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="nav-tab"
      :class="{ current: tab.isCurrent }"
      :aria-current="tab.isCurrent ? 'page' : undefined"
      :title="tab.label"
    >
      <img v-if="tab.to === '/team' && teamLogoUrl" class="nav-tab-logo" :src="teamLogoUrl" alt="" />
      <SvgIcon v-else :name="tab.icon" size="22px" />
      <span class="nav-tab-label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.nav-tabs {
  display: flex;
}

.nav-tab {
  display: flex;
  align-items: center;
  color: $color-text-secondary;
  text-decoration: none;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: $color-text-primary;
  }

  &.current {
    color: $color-accent;
  }
}

.nav-tab-logo {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: $radius-sm;
  object-fit: cover;
}

// In the top bar: a row of tabs, the current one underlined; their names fold away
// on a tablet; on a phone the bar at the foot of the screen takes over
.nav-tabs--top {
  align-self: stretch;
  gap: $spacing-xs;

  .nav-tab {
    gap: $spacing-sm;
    padding: 0 $spacing-md;
    border-bottom: 3px solid transparent;
    border-top: 3px solid transparent;
    font-weight: 600;

    &:hover {
      background: $color-bg-tertiary;
    }

    &.current {
      border-bottom-color: $color-accent;
    }
  }

  @include tablet {
    .nav-tab {
      padding: 0 0.75rem;
    }

    .nav-tab-label {
      display: none;
    }
  }

  @include mobile-lg {
    display: none;
  }
}

// At the foot of a phone's screen: the tabs share its width, their name under their icon
.nav-tabs--bottom {
  display: none;

  @include mobile-lg {
    display: flex;
    flex-shrink: 0;
    background: $color-bg-secondary;
    border-top: $border-thin solid $color-border;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .nav-tab {
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-height: $bottom-nav-height;
    font-size: $font-size-xs;
    font-weight: 600;
  }
}
</style>
