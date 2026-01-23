<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import SvgIcon from '@/components/common/SvgIcon.vue';

defineProps<{
  isAuthenticated?: boolean;
  userName?: string;
}>();

const router = useRouter();
const showUserMenu = ref(false);

function goToHome() {
  router.push('/');
}

function goToLogin() {
  router.push('/login');
}

function goToProfile() {
  showUserMenu.value = false;
  router.push('/profile');
}

function goToTeam() {
  showUserMenu.value = false;
  router.push('/team');
}

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value;
}

function closeUserMenu() {
  showUserMenu.value = false;
}
</script>

<template>
  <header class="top-bar">
    <!-- Section Logo - tout à gauche (immuable) -->
    <div class="section-logo">
      <button class="btn-home" @click="goToHome" title="Retour à l'accueil">
        <SvgIcon name="home" class="home-icon" />
      </button>
    </div>

    <!-- Section centrale - Dynamique (slot) -->
    <div class="section-dynamic">
      <slot></slot>
    </div>

    <!-- Section Login/Profile - tout à droite (immuable) -->
    <div class="section-auth">
      <template v-if="isAuthenticated">
        <div class="user-menu-wrapper">
          <button class="btn-user" @click="toggleUserMenu">
            <span>{{ userName || 'Mon compte' }}</span>
            <SvgIcon name="settings" class="settings-icon" />
          </button>
          <div v-if="showUserMenu" class="user-menu">
            <button class="menu-item" @click="goToProfile">
              <SvgIcon name="user" />
              <span>Profil</span>
            </button>
            <button class="menu-item" @click="goToTeam">
              <SvgIcon name="users" />
              <span>Mon équipe</span>
            </button>
          </div>
          <!-- Backdrop to close menu on click outside -->
          <div v-if="showUserMenu" class="menu-backdrop" @click="closeUserMenu"></div>
        </div>
      </template>
      <template v-else>
        <button class="btn-login" @click="goToLogin">
          <SvgIcon name="user" class="login-icon" />
          <span>Login</span>
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.top-bar {
  display: flex;
  align-items: stretch;
  background: $color-bg-secondary;
  border-bottom: 1px solid $color-border;
  min-height: 70px;

  @include tablet {
    min-height: 60px;
  }

  @include mobile-lg {
    min-height: 56px;
  }

  @include mobile {
    min-height: 52px;
  }
}

.section-logo {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  border-right: 1px solid $color-border;

  @include tablet {
    padding: $spacing-sm 0.75rem;
  }

  @include mobile-lg {
    padding: $spacing-sm;
  }

  @include mobile {
    border: none;
  }
}

.btn-home {
  width: 48px;
  height: 48px;
  border: none;
  background: $color-bg-tertiary;
  border-radius: $radius-md;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    transform: scale(1.05);
  }

  @include tablet {
    width: $touch-target-min;
    height: $touch-target-min;
  }

  @include mobile-lg {
    width: 40px;
    height: 40px;
    padding: 6px;
  }

  @include mobile {
    width: 36px;
    height: 36px;
    border-radius: 6px;
  }
}

.home-icon {
  width: 100%;
  height: 100%;
  fill: $color-accent;

  .btn-home:hover & {
    fill: $color-accent;
  }
}

.section-dynamic {
  flex: 1;
  display: flex;
  align-items: stretch;
}

.section-auth {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  border-left: 1px solid $color-border;

  @include tablet {
    padding: $spacing-sm 0.75rem;
  }

  @include mobile-lg {
    padding: $spacing-sm;
  }

  @include mobile {
    border: none;
  }
}

.btn-login,
.btn-profile {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  border: 2px solid rgba($color-accent, 0.4);
  background: transparent;
  color: $color-accent;
  border-radius: 6px;
  font-weight: 600;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-bg-tertiary;
    border-color: $color-accent;
    color: $color-white;
  }

  @include mobile-lg {
    padding: $spacing-sm;
    gap: 0;

    > span:not(.svg-icon) {
      display: none;
    }
  }

  @include mobile {
    width: 36px;
    height: 36px;
    padding: 6px;
    border-radius: 6px;
  }
}

.btn-profile {
  border-color: $color-success;
  color: $color-success;

  &:hover {
    border-color: $color-success;
    color: $color-white;
    background: rgba($color-success, 0.1);
  }
}

.btn-team {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 6px;
  border: 2px solid $color-star;
  background: transparent;
  color: $color-star;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: $spacing-sm;

  &:hover {
    background: rgba($color-star, 0.1);
    border-color: $color-star;
    color: $color-white;
  }

  @include mobile {
    width: 32px;
    height: 32px;
  }
}

.team-icon {
  width: 20px !important;
  height: 20px !important;
  fill: currentColor;
}

.login-icon,
.profile-icon {
  width: 20px !important;
  height: 20px !important;
  fill: currentColor;
  flex-shrink: 0;

  @include mobile-lg {
    width: 24px !important;
    height: 24px !important;
  }

  @include mobile {
    width: 22px !important;
    height: 22px !important;
  }
}

.user-menu-wrapper {
  position: relative;
}

.btn-user {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  border: 2px solid $color-accent;
  background: transparent;
  color: $color-accent;
  border-radius: 6px;
  font-weight: 600;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-bg-tertiary;
    color: $color-white;
  }

  @include mobile-lg {
    padding: $spacing-sm;
    gap: 0;

    > span:not(.svg-icon) {
      display: none;
    }
  }

  @include mobile {
    width: 36px;
    height: 36px;
    padding: 6px;
    border-radius: 6px;
  }
}

.settings-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: 6px;
  box-shadow: 0 4px 12px $color-shadow;
  z-index: 1000;
  min-width: 160px;
  overflow: hidden;

  .menu-item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    width: 100%;
    border: none;
    background: transparent;
    color: $color-text-secondary;
    font-size: $font-size-sm;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;

    :deep(svg) {
      width: 18px;
      height: 18px;
      fill: currentColor;
      flex-shrink: 0;
    }

    &:hover {
      background: $color-bg-tertiary;
      color: $color-text-primary;
    }

    &:first-child {
      border-radius: 6px 6px 0 0;
    }

    &:last-child {
      border-radius: 0 0 6px 6px;
    }
  }
}

.menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}
</style>

