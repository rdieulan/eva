<script lang="ts">
// A choice among a few options, each with its label and, below it, a hint
export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}
</script>

<script setup lang="ts" generic="T extends string | number">
// A segmented control: the options side by side, quiet, the one chosen lit
defineProps<{
  options: SegmentedOption<T>[];
  label: string; // What the choice is about, for screen readers
  disabled?: boolean;
  fill?: boolean; // Take the width given, the options sharing it equally
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="segmented" :class="{ 'segmented--fill': fill }" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      class="segment"
      :class="{ active: option.value === model }"
      :aria-checked="option.value === model"
      :disabled="disabled"
      @click="model = option.value"
    >
      <span class="segment-label">{{ option.label }}</span>
      <span v-if="option.hint" class="segment-hint">{{ option.hint }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.segmented {
  display: inline-flex;
  padding: 3px;
  background: with-alpha($color-bg-primary, 0.6);
  border: $border-thin solid $color-border-light;
  border-radius: $radius-md;

  &--fill {
    display: flex;

    .segment {
      flex: 1 1 0;
      min-width: 0;
    }
  }
}

.segment {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 0.4rem 0.9rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: $color-text-secondary;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    color: $color-white;
  }

  &.active {
    background: $color-bg-tertiary;
    color: $color-white;
    box-shadow: 0 1px 2px with-alpha($color-black, 0.3);
  }

  &:disabled {
    cursor: default;
  }

  @include mobile {
    padding: 0.35rem 0.45rem;
    font-size: 0.8rem;
  }
}

.segment-hint {
  color: $color-text-secondary;
  font-size: 0.72rem;
  font-weight: 500;

  .active & {
    color: $color-text-muted;
  }
}
</style>
