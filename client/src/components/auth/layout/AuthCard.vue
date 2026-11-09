<script setup lang="ts">
// The card of the pages one reaches before being signed in: signing in, an
// invitation to a role. Layout only: a title, then what the page puts in it.

defineProps<{
  title: string;
}>();
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>{{ title }}</h1>
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.auth-page {
  min-height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  @include surface-gradient;
  padding: $spacing-xl;

  @include tablet {
    padding: $spacing-lg;
  }

  @include mobile-lg {
    padding: $spacing-md;
    align-items: flex-start;
    padding-top: $spacing-2xl;
  }

  @include mobile {
    padding: 0.75rem;
    padding-top: $spacing-xl;
  }
}

.auth-card {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border-light;
  border-radius: $radius-xl;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;

  @include tablet {
    padding: $spacing-xl;
  }

  @include mobile-lg {
    padding: $spacing-lg;
    border-radius: $radius-lg;
  }

  @include mobile {
    padding: 1.25rem;
    border-radius: 10px;
  }
}

// The card spaces what it holds: an error box keeps no margin of its own
:slotted(.error-display) {
  margin: 0;
}

h1 {
  color: $color-white;
  text-align: center;
  margin: 0;
  font-size: 1.8rem;

  @include mobile-lg {
    font-size: 1.5rem;
  }

  @include mobile {
    font-size: 1.35rem;
  }
}
</style>
