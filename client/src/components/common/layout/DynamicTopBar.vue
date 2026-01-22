<script setup lang="ts">
import { useRouter } from 'vue-router';
import SvgIcon from '@/components/common/SvgIcon.vue';

defineProps<{
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
        <button class="btn-profile" @click="goToProfile">
          <SvgIcon name="user" class="profile-icon" />
          <span>{{ userName || 'Profil' }}</span>
        </button>
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
    fill: $color-accent-light;
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
  border: 2px solid #4a4a8a;
  background: transparent;
  color: $color-accent-light;
  border-radius: 6px;
  font-weight: 600;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-bg-tertiary;
    border-color: $color-accent;
    color: #fff;
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
    border-color: #6ee7a0;
    color: #fff;
    background: rgba(74, 222, 128, 0.1);
  }
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
</style>

