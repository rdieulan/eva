<script setup lang="ts">
// The button that signs in with Discord: a link, since the browser leaves for
// Discord's page and comes back through the server

import SvgIcon from '@/components/common/SvgIcon.vue';

withDefaults(defineProps<{
  href: string;
  label?: string;
}>(), {
  label: 'Se connecter avec Discord',
});
</script>

<template>
  <a class="discord-sign-in" :href="href">
    <SvgIcon name="discord" class="discord-logo" />
    <span>{{ label }}</span>
  </a>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.discord-sign-in {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  width: 100%;
  padding: 0.875rem $spacing-md;
  background: $color-discord;
  border-radius: $radius-md;
  // White on Discord's blue, as its brand has it, whatever the theme
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.2s;

  &:hover {
    background: shade($color-discord, 15%);
  }

  &:focus-visible {
    outline: 2px solid $color-white;
    outline-offset: 2px;
  }

  @include mobile {
    padding: 0.75rem;
    font-size: 0.95rem;
  }
}

.discord-logo {
  width: 1.4rem;
  height: 1.4rem;
  flex-shrink: 0;
}
</style>
