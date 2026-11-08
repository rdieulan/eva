<script setup lang="ts">
import {
  getTeamAvailabilityClass,
  getTeamAvailabilityDisplay,
  TEAM_AVAILABILITY_STATUSES,
} from '@/utils/availability';

defineProps<{
  editMode: boolean; // The days show every player's status; otherwise one colour, the team's lineup
  matchmaking?: boolean; // No editing of one's own days while looking for an opponent
}>();

defineEmits<{
  toggleEditMode: [];
}>();
</script>

<template>
  <div class="calendar-toolbar">
    <!-- What the colour of a day means: the team's lineup. The reader's own
         answer, in the corner, is named on the wheel that sets it. -->
    <div class="availability-legend" title="Case : l'équipe">
      <span
        v-for="status in TEAM_AVAILABILITY_STATUSES"
        :key="status"
        class="legend-item"
        :class="getTeamAvailabilityClass(status)"
        :title="getTeamAvailabilityDisplay(status).title"
      >
        <span class="legend-dot"></span>
        <span class="legend-label">{{ getTeamAvailabilityDisplay(status).label }}</span>
      </span>
    </div>

    <!-- Edit mode button: a player edits their own days, which has no place in matchmaking -->
    <button
      v-if="!matchmaking"
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
  background: with-alpha($color-bg-tertiary, 0.5);
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
  border: $border-thin solid;

  // A day nobody answered for: the neutral style of an answer not given
  .availability--unset & {
    background: $color-border;
    border-color: $color-text-secondary;
  }

  @each $status, $color in $team-availability-colors {
    .team-availability--#{$status} & {
      background: $color;
      border-color: $color;
    }
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

  @each $status, $color in $team-availability-colors {
    .team-availability--#{$status} & {
      color: $color;
    }
  }
}

.edit-mode-btn {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 0.5rem 1rem;
  background: with-alpha($color-edit, 0.1);
  border: $border-thick solid $color-edit;
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
    background: with-alpha($color-edit, 0.2);
    border-color: $color-edit;
    color: $color-white;
  }

  &.active {
    background: with-alpha($color-success, 0.2);
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
