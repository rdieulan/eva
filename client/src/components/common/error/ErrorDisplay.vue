<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  errors: string[];
  fallback?: string;
}>();

const displayErrors = computed(() => {
  if (props.errors.length) return props.errors;
  if (props.fallback) return [props.fallback];
  return [];
});

const hasErrors = computed(() => displayErrors.value.length > 0);
</script>

<template>
  <div v-if="hasErrors" class="error-display">
    <p v-for="(err, i) in displayErrors" :key="i">{{ err }}</p>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.error-display {
  background-color: rgba($color-danger, 0.1);
  border: 1px solid rgba($color-danger, 0.3);
  color: $color-danger;
  padding: $spacing-sm;
  border-radius: $radius-sm;
  margin-bottom: $spacing-md;
  font-size: $font-size-sm;

  p {
    margin: 0;

    & + p {
      margin-top: $spacing-xs;
    }
  }
}
</style>
