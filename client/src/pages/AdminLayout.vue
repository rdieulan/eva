<script setup lang="ts">
import { computed } from 'vue';
import { RouterView } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const { account } = useAuth();

const canManageAdmins = computed(() => {
  return account.value?.adminPermissions?.system?.canManageAdmins === true;
});
</script>

<template>
  <div class="admin-layout">
    <header class="admin-header">
      <h1>Administration</h1>
      <nav class="admin-nav">
        <RouterLink :to="{ name: 'admin-venues' }" class="admin-nav__link">Salles</RouterLink>
        <RouterLink :to="{ name: 'admin-managers' }" class="admin-nav__link">Managers</RouterLink>
        <RouterLink v-if="canManageAdmins" :to="{ name: 'admin-admins' }" class="admin-nav__link">Administrateurs</RouterLink>
        <RouterLink :to="{ name: 'admin-players' }" class="admin-nav__link">Joueurs</RouterLink>
        <RouterLink :to="{ name: 'admin-teams' }" class="admin-nav__link">Équipes</RouterLink>
      </nav>
    </header>

    <main class="admin-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.admin-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.admin-header {
  display: flex;
  align-items: center;
  gap: $spacing-xl;
  padding: $spacing-lg $spacing-xl;
  border-bottom: 1px solid $color-border;
  background: $color-bg-secondary;

  h1 {
    margin: 0;
    color: $color-text-primary;
    font-size: $font-size-2xl;
  }

  @include mobile-lg {
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-md;
    padding: $spacing-md;
  }
}

.admin-nav {
  display: flex;
  gap: $spacing-sm;
  flex-wrap: wrap;

  &__link {
    color: $color-text-secondary;
    text-decoration: none;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-md;
    font-weight: 500;
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: $color-bg-tertiary;
      color: $color-text-primary;
    }

    &.router-link-active {
      background: $color-accent;
      color: $color-white;
    }
  }
}

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-lg $spacing-xl;
  background: $color-bg-primary;

  @include mobile-lg {
    padding: $spacing-md;
  }
}
</style>
