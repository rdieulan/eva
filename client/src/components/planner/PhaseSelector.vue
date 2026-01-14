<script setup lang="ts">
import type { GamePhase } from '@/types';
import { PHASE_LABELS } from '@shared/types';
import SvgIcon from '@/components/common/SvgIcon.vue';

const props = withDefaults(defineProps<{
  modelValue: GamePhase;
  disabled?: boolean;
  compact?: boolean;
}>(), {
  disabled: false,
  compact: false,
});

const emit = defineEmits<{
  'update:modelValue': [phase: GamePhase];
}>();

interface PhaseOption {
  value: GamePhase;
  label: string;
  icon: string;
  color: string;
}

const phases: PhaseOption[] = [
  { value: 'START', label: PHASE_LABELS.START, icon: 'flag', color: '#4ade80' },
  { value: 'ATTACK', label: PHASE_LABELS.ATTACK, icon: 'sword', color: '#ff6b6b' },
  { value: 'DEFENSE', label: PHASE_LABELS.DEFENSE, icon: 'shield', color: '#60a5fa' },
];

function selectPhase(phase: GamePhase) {
  if (!props.disabled) {
    emit('update:modelValue', phase);
  }
}

const isActive = (phase: GamePhase) => props.modelValue === phase;
</script>

<template>
  <div class="phase-selector" :class="{ compact, disabled }">
    <button
      v-for="phase in phases"
      :key="phase.value"
      class="phase-btn"
      :class="{ active: isActive(phase.value) }"
      :style="{ '--phase-color': phase.color }"
      :disabled="disabled"
      @click="selectPhase(phase.value)"
      :title="phase.label"
    >
      <SvgIcon :name="phase.icon" class="phase-icon" />
      <span v-if="!compact" class="phase-label">{{ phase.label }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.phase-selector {
  display: flex;
  gap: $spacing-xs;
  background: $color-bg-secondary;
  padding: $spacing-xs;
  border-radius: $radius-md;
  border: 1px solid $color-border;

  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  &.compact {
    padding: 2px;
    gap: 2px;

    .phase-btn {
      padding: $spacing-xs;
      min-width: unset;
    }

    .phase-icon {
      width: 16px;
      height: 16px;
    }
  }
}

.phase-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
  min-width: 80px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: $color-bg-tertiary;
    color: $color-text-primary;
  }

  &.active {
    background: color-mix(in srgb, var(--phase-color) 20%, transparent);
    border-color: var(--phase-color);
    color: var(--phase-color);

    .phase-icon {
      fill: var(--phase-color);
    }
  }

  &:disabled {
    cursor: not-allowed;
  }

  @include mobile-lg {
    padding: $spacing-xs $spacing-sm;
    min-width: 60px;
    font-size: $font-size-xs;
  }

  @include mobile {
    padding: $spacing-xs;
    min-width: unset;

    .phase-label {
      display: none;
    }
  }
}

.phase-icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
  flex-shrink: 0;

  @include mobile-lg {
    width: 16px;
    height: 16px;
  }
}

.phase-label {
  white-space: nowrap;
}
</style>

