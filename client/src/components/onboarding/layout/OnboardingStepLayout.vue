<script setup lang="ts">
// One step of the first-login walk-through: its question, a line to explain
// it, the field, then what to do. Layout only.

defineProps<{
  title: string;
  lead?: string;
}>();
</script>

<template>
  <section class="onboarding-step">
    <header class="step-header">
      <h2>{{ title }}</h2>
      <p v-if="lead" class="step-lead">{{ lead }}</p>
    </header>

    <div class="step-body">
      <slot />
    </div>

    <footer class="step-actions">
      <slot name="actions" />
    </footer>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.onboarding-step {
  display: flex;
  flex-direction: column;
  gap: $spacing-xl;

  @include mobile {
    gap: $spacing-lg;
  }
}

.step-header {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  h2 {
    margin: 0;
    color: $color-white;
    font-size: 1.75rem;
    line-height: 1.2;

    @include mobile {
      font-size: 1.45rem;
    }
  }
}

.step-lead {
  margin: 0;
  color: $color-text-secondary;
  line-height: 1.55;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.step-actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}
</style>
