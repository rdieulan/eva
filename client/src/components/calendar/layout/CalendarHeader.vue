<script setup lang="ts">
import SegmentedControl, { type SegmentedOption } from '@/components/common/SegmentedControl.vue';
import MatchmakingVenuePicker from '@/components/calendar/MatchmakingVenuePicker.vue';
import CalendarNav from '@/components/calendar/layout/CalendarNav.vue';
import CalendarViewSwitch from '@/components/calendar/layout/CalendarViewSwitch.vue';
import WeekdayNames from '@/components/calendar/layout/WeekdayNames.vue';
import type { CalendarMode } from '@/composables/useCalendar';
import type { ViewMode } from '@/composables/useCalendarNavigation';
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

const MODE_OPTIONS: SegmentedOption<CalendarMode>[] = [
  { value: 'team', label: 'Équipe' },
  { value: 'matchmaking', label: 'Matchmaking' },
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

      <CalendarNav :view-mode="viewMode" :title="navigationTitle" @prev="emit('prev')" @next="emit('next')" />

      <CalendarViewSwitch
        class="view-switch"
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
    <WeekdayNames v-if="viewMode === 'month'" />
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
</style>
