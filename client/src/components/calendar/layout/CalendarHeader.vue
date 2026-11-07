<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue';
import SegmentedControl, { type SegmentedOption } from '@/components/common/SegmentedControl.vue';
import MatchmakingVenuePicker from '@/components/calendar/MatchmakingVenuePicker.vue';
import type { ViewMode, CalendarMode } from '@/composables/useCalendar';
import type { MatchmakingVenues } from '@/utils/venues';

defineProps<{
  viewMode: ViewMode;
  calendarMode: CalendarMode;
  navigationTitle: string;
  venues: MatchmakingVenues; // Matchmaking: the venues the menu lists
  canEditFavorites?: boolean; // The reader may change the team's favorite venues
  favoritesFull?: boolean;
  savingFavorites?: boolean;
  canSearch?: boolean; // The reader may put days up for an opponent
}>();

const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode];
  'update:calendarMode': [mode: CalendarMode];
  prev: [];
  next: [];
  'toggle-favorite': [venueId: string];
}>();

// Matchmaking: the venues whose searches the calendar shows
const venueIds = defineModel<string[]>('venueIds', { required: true });

const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const MODE_OPTIONS: SegmentedOption<CalendarMode>[] = [
  { value: 'team', label: 'Équipe' },
  { value: 'matchmaking', label: 'Matchmaking' },
];

const VIEW_OPTIONS: SegmentedOption<ViewMode>[] = [
  { value: 'month', label: 'Mois' },
  { value: 'week', label: 'Semaine' },
];
</script>

<template>
  <div class="calendar-controls">
    <!-- One row: what we look at (left), when (centre), how (right) -->
    <div class="controls-row">
      <SegmentedControl
        class="mode-switch"
        label="Mode"
        :options="MODE_OPTIONS"
        :model-value="calendarMode"
        @update:model-value="mode => emit('update:calendarMode', mode)"
      />

      <div class="nav-header">
        <button
          class="nav-btn"
          @click="$emit('prev')"
          :title="viewMode === 'month' ? 'Mois précédent' : 'Semaine précédente'"
        >
          <SvgIcon name="chevron-right" class="nav-icon nav-icon-left" />
        </button>
        <h2 class="nav-title">{{ navigationTitle }}</h2>
        <button
          class="nav-btn"
          @click="$emit('next')"
          :title="viewMode === 'month' ? 'Mois suivant' : 'Semaine suivante'"
        >
          <SvgIcon name="chevron-right" class="nav-icon" />
        </button>
      </div>

      <SegmentedControl
        class="view-switch"
        label="Affichage"
        :options="VIEW_OPTIONS"
        :model-value="viewMode"
        @update:model-value="mode => emit('update:viewMode', mode)"
      />
    </div>

    <!-- Matchmaking: which venues the days show, and what to do next -->
    <div v-if="calendarMode === 'matchmaking'" class="venue-row">
      <MatchmakingVenuePicker
        v-model="venueIds"
        :venues="venues"
        :can-edit-favorites="canEditFavorites ?? false"
        :favorites-full="favoritesFull ?? false"
        :saving-favorites="savingFavorites ?? false"
        @toggle-favorite="id => emit('toggle-favorite', id)"
      />
      <p v-if="canSearch && venueIds.length" class="search-hint">
        Clique sur les jours où tu veux jouer, puis choisis les créneaux à proposer.
      </p>
    </div>

    <!-- Weekdays header (only for month view) -->
    <div v-if="viewMode === 'month'" class="weekdays-header">
      <div v-for="dayName in weekdays" :key="dayName" class="weekday-name">
        {{ dayName }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.calendar-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  width: 100%;
  padding: $spacing-sm $spacing-xl;
  @include surface-gradient;
  flex-shrink: 0;

  @include tablet {
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-lg;
  }

  @include mobile-lg {
    gap: $spacing-xs;
    padding: $spacing-sm $spacing-md;
  }

  @include mobile {
    padding: $spacing-xs $spacing-sm;
  }
}

.controls-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: $spacing-md;
  width: 100%;
  max-width: 1200px;

  @include mobile-lg {
    grid-template-columns: 1fr 1fr;
    grid-template-areas: 'nav nav' 'mode view';
    gap: $spacing-sm;

    .nav-header { grid-area: nav; }
    .mode-switch { grid-area: mode; }
    .view-switch { grid-area: view; }
  }
}

.mode-switch {
  justify-self: start;
}

.view-switch {
  justify-self: end;
}

.venue-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-sm $spacing-md;
  width: 100%;
  max-width: 1200px;
}

.search-hint {
  margin: 0;
  color: $color-text-secondary;
  font-size: 0.8rem;
}

.nav-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-lg;

  @include tablet {
    gap: $spacing-md;
  }

  @include mobile-lg {
    gap: 0.75rem;
  }

  @include mobile {
    gap: $spacing-sm;
  }
}

.nav-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg-tertiary;
  border: $border-thin solid $color-border;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    border-color: $color-accent;
  }

  @include mobile-lg {
    width: 36px;
    height: 36px;
  }

  @include mobile {
    width: 32px;
    height: 32px;
  }
}

.nav-icon {
  width: 20px;
  height: 20px;
  fill: $color-text-secondary;

  &.nav-icon-left {
    transform: rotate(180deg);
  }

  .nav-btn:hover & {
    fill: $color-white;
  }

  @include mobile {
    width: 16px;
    height: 16px;
  }
}

.nav-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: $color-white;
  text-align: center;
  min-width: 200px;

  @include tablet {
    font-size: 1.15rem;
    min-width: 180px;
  }

  @include mobile-lg {
    font-size: 1rem;
    min-width: 150px;
  }

  @include mobile {
    font-size: 0.9rem;
    min-width: 130px;
  }
}

.weekdays-header {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr)); // Same columns as the grid below
  gap: $spacing-sm;
  width: 100%;
  max-width: 1200px;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: $spacing-xs;
  }

  @include mobile {
    gap: 0.15rem;
  }
}

.weekday-name {
  text-align: center;
  font-weight: 600;
  font-size: 0.85rem;
  color: $color-accent;
  padding: $spacing-xs;

  @include mobile-lg {
    font-size: 0.7rem;
    padding: 0.15rem;
  }

  @include mobile {
    font-size: 0.65rem;
    padding: 0.1rem;
  }
}
</style>
