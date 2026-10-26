<script setup lang="ts">
import { AVAILABILITY_STATUSES } from '@shared/types';
import { getAvailabilityClass, getAvailabilityDisplay } from '@/utils/availability';

// Every status, then "not set"
const legendStatuses = [...AVAILABILITY_STATUSES, null];

defineProps<{
  editMode: boolean;
}>();

defineEmits<{
  toggleEditMode: [];
}>();
</script>

<template>
  <div class="calendar-toolbar">
    <!-- Availability legend -->
    <div class="availability-legend">
      <span
        v-for="status in legendStatuses"
        :key="status ?? 'unset'"
        class="legend-item"
        :class="getAvailabilityClass(status)"
        :title="getAvailabilityDisplay(status).title"
      >
        <span class="legend-dot"></span>
        <span class="legend-label">{{ getAvailabilityDisplay(status).label }}</span>
      </span>
    </div>

    <!-- Edit mode button -->
    <button
      class="edit-mode-btn"
      :class="{ active: editMode }"
      @pointerdown.prevent="$emit('toggleEditMode')"
      :title="editMode ? 'Quitter le mode édition' : 'Modifier mes disponibilités'"
    >
      <span class="edit-icon">✏️</span>
      <span class="edit-label">{{ editMode ? 'Terminer' : 'Dispos' }}</span>
    </button>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables' as *;
@use 'sass:map';

.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: $spacing-lg;

  @include mobile-lg {
    gap: $spacing-sm;
  }
}

.availability-legend {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: 0.4rem 0.75rem;
  background: rgba($color-bg-tertiary, 0.5);
  border-radius: $radius-md;
  font-size: 0.8rem;

  @include tablet {
    gap: $spacing-sm;
  }

  @include mobile-lg {
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.7rem;
  }

  @include mobile {
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 0.2rem 0.5rem;
    padding: 0.25rem 0.4rem;
    font-size: 0.6rem;
  }
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;

  @include mobile-lg {
    gap: 0.2rem;
  }

  @include mobile {
    gap: 0.15rem;
  }
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid;

  @each $status, $style in $availability-styles {
    .availability--#{$status} & {
      background: map.get($style, color);
      border-color: map.get($style, color);
    }
  }

  .availability--unset & {
    background: $color-border;
    border-color: $color-text-secondary;
  }

  @include mobile-lg {
    width: 10px;
    height: 10px;
  }

  @include mobile {
    width: 8px;
    height: 8px;
  }
}

.legend-label {
  color: $color-text-secondary;

  @each $status, $style in $availability-styles {
    .availability--#{$status} & {
      color: map.get($style, color);
    }
  }
}

.edit-mode-btn {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 0.5rem 1rem;
  background: rgba($color-edit, 0.1);
  border: 2px solid $color-edit;
  border-radius: $radius-md;
  color: $color-edit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: rgba($color-edit, 0.2);
    border-color: $color-edit;
    color: $color-white;
  }

  &.active {
    background: rgba($color-success, 0.2);
    border-color: $color-success;
    color: $color-success;
  }

  .edit-icon {
    font-size: 1rem;
  }

  @include mobile-lg {
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
    gap: $spacing-xs;

    .edit-label {
      display: none;
    }
  }
}
</style>
