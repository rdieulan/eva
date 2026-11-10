<script setup lang="ts">
// The roles of the account: player always, venue manager and admin when given
// by invitation, each with what it opens. The session acts as one of them; the
// top bar switches too, in one click (see RoleSwitch).
import { ROLE_LABELS as ROLES, useRoleSwitch } from '@/composables/useRoleSwitch';
import { useAuth } from '@/composables/useAuth';
import ErrorDisplay from '@/components/common/error/ErrorDisplay.vue';

const { account } = useAuth();
const { roles, actAs, errors } = useRoleSwitch();
</script>

<template>
  <section v-if="roles.length > 1" class="profile-section roles-section">
    <h2>Rôle</h2>
    <p class="section-hint">Ton compte a plusieurs rôles : choisis celui sous lequel tu agis.</p>

    <div class="roles-list">
      <button
        v-for="role in roles"
        :key="role"
        type="button"
        class="role-item"
        :class="{ current: role === account?.accountType }"
        :disabled="role === account?.accountType"
        @click="actAs(role)"
      >
        <span class="role-info">
          <span class="role-name">{{ ROLES[role].label }}</span>
          <span class="role-hint">{{ ROLES[role].hint }}</span>
        </span>
        <span v-if="role === account?.accountType" class="current-badge">Actuel</span>
        <span v-else class="switch-hint">Passer à ce rôle</span>
      </button>
    </div>

    <ErrorDisplay :errors="errors" />
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.section-hint {
  color: $color-text-secondary;
  font-size: $font-size-sm;
  margin: 0 0 $spacing-md;
}

.roles-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.role-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-md;
  width: 100%;
  padding: $spacing-sm $spacing-md;
  background: $color-bg-secondary;
  border: $border-thin solid $color-border;
  border-radius: $radius-md;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.current) {
    border-color: $color-accent;
    background: with-alpha($color-accent, 0.1);
  }

  &.current {
    border-color: $color-accent;
    cursor: default;
  }
}

.role-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.role-name {
  color: $color-text-primary;
  font-weight: 500;
}

.role-hint {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}

.current-badge {
  flex-shrink: 0;
  background: $color-accent;
  color: $color-white;
  padding: 2px 8px;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  font-weight: 500;
}

.switch-hint {
  flex-shrink: 0;
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
</style>
