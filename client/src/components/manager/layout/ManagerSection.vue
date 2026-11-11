<script setup lang="ts">
// A section of a page of the manager's space: its title, with the symbol of
// its subject when it has one, a word on what it is for, then its content
import type { Subject } from '@shared/types';
import SubjectIcon from '@/components/common/SubjectIcon.vue';

defineProps<{
  title: string;
  subject?: Subject;
}>();
</script>

<template>
  <section class="manager-section">
    <h2><SubjectIcon v-if="subject" :subject="subject" size="22px" />{{ title }}</h2>
    <p v-if="$slots.intro" class="manager-intro"><slot name="intro" /></p>
    <slot />
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.manager-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-lg;
  background: with-alpha($color-bg-secondary, 0.6);
  border: $border-thin solid $color-border-light;
  border-radius: $radius-lg;

  @include mobile-lg {
    padding: $spacing-md;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin: 0;
    font-size: $font-size-xl;
    color: $color-text-primary;
  }
}

.manager-intro {
  margin: 0;
  max-width: 70ch;
  color: $color-text-secondary;
}
</style>
