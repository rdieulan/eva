<script setup lang="ts">
// The roles of the account, in the top bar, for one who has more than one:
// the one the session acts as marked, another one click away. Each role keeps
// to its own pages: a player's team, a manager's venue. Its name folds away
// on a phone, its symbol stays.
import { useRoleSwitch, ROLE_LABELS } from '@/composables/useRoleSwitch';
import type { AccountType } from '@shared/types';
import SvgIcon from '@/components/common/SvgIcon.vue';

const { roles, current, actAs } = useRoleSwitch();

const ICONS: Record<AccountType, 'user' | 'place' | 'shield'> = {
  player: 'user',
  manager: 'place',
  admin: 'shield',
};
</script>

<template>
  <div v-if="roles.length > 1" class="role-switch" role="radiogroup" aria-label="Agir en tant que">
    <button
      v-for="role in roles"
      :key="role"
      type="button"
      role="radio"
      class="role-option"
      :class="{ current: role === current }"
      :aria-checked="role === current"
      :title="role === current ? `Tu agis en ${ROLE_LABELS[role].label.toLowerCase()}` : `Passer en ${ROLE_LABELS[role].label.toLowerCase()} : ${ROLE_LABELS[role].hint.toLowerCase()}`"
      @click="actAs(role)"
    >
      <SvgIcon :name="ICONS[role]" size="16px" />
      <span class="role-label">{{ ROLE_LABELS[role].label }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.role-switch {
  display: flex;
  padding: 2px;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-radius: 999px;
}

.role-option {
  display: inline-flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-md;
  background: transparent;
  border: none;
  border-radius: 999px;
  color: $color-text-secondary;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(.current) {
    color: $color-text-primary;
  }

  // The role the session acts as: the way around the app, the accent
  &.current {
    background: with-alpha($color-accent, 0.2);
    color: $color-accent;
    cursor: default;
  }

  @include mobile-lg {
    padding: $spacing-xs $spacing-sm;
  }
}

.role-label {
  @include mobile-lg {
    display: none;
  }
}
</style>
