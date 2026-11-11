<script setup lang="ts">
/**
 * CalendarBody - Layout component
 * Wrapper for the main calendar content area.
 * Contains CalendarGrid or WeekGrid based on view mode.
 */
import CalendarGrid from '@/components/calendar/CalendarGrid.vue';
import WeekGrid from '@/components/calendar/WeekGrid.vue';
import type { DayData, CalendarEvent, ScrimSearch, VenueEventView } from '@shared/types';
import type { WheelOpening } from '@/components/calendar/AvailabilityWheel.vue';

defineProps<{
  viewMode: 'month' | 'week';
  year: number;
  month: number;
  weekStart: Date;
  days: Record<string, DayData>;
  editMode: boolean;
  matchmaking?: boolean;
  scrimSearches?: Record<string, ScrimSearch[]>;
  selectable?: boolean;
  selectedDates?: string[];
  currentPlayerId?: string;
}>();

defineEmits<{
  'prev-month': [];
  'next-month': [];
  'prev-week': [];
  'next-week': [];
  'open-availability': [opening: WheelOpening];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
  'open-create-event': [date: string];
  'toggle-select': [date: string];
  'open-search': [search: ScrimSearch];
  'open-venue-event': [event: VenueEventView];
  'open-day': [date: string];
}>();
</script>

<template>
  <div class="calendar-body">
    <!-- Month view -->
    <CalendarGrid
      v-if="viewMode === 'month'"
      :year="year"
      :month="month"
      :days="days"
      :edit-mode="editMode"
      :matchmaking="matchmaking"
      :scrim-searches="scrimSearches"
      :selectable="selectable"
      :selected-dates="selectedDates"
      :current-player-id="currentPlayerId"
      @prev-month="$emit('prev-month')"
      @next-month="$emit('next-month')"
      @open-availability="(opening) => $emit('open-availability', opening)"
      @open-event-viewer="(events, idx) => $emit('open-event-viewer', events, idx)"
      @open-create-event="(date) => $emit('open-create-event', date)"
      @toggle-select="(date) => $emit('toggle-select', date)"
      @open-search="(search) => $emit('open-search', search)"
      @open-venue-event="(venueEvent) => $emit('open-venue-event', venueEvent)"
      @open-day="(date) => $emit('open-day', date)"
    />

    <!-- Week view -->
    <WeekGrid
      v-else
      :year="year"
      :month="month"
      :week-start="weekStart"
      :days="days"
      :edit-mode="editMode"
      :matchmaking="matchmaking"
      :scrim-searches="scrimSearches"
      :selectable="selectable"
      :selected-dates="selectedDates"
      :current-player-id="currentPlayerId"
      @prev-week="$emit('prev-week')"
      @next-week="$emit('next-week')"
      @open-availability="(opening) => $emit('open-availability', opening)"
      @open-event-viewer="(events, idx) => $emit('open-event-viewer', events, idx)"
      @open-create-event="(date) => $emit('open-create-event', date)"
      @toggle-select="(date) => $emit('toggle-select', date)"
      @open-search="(search) => $emit('open-search', search)"
      @open-venue-event="(venueEvent) => $emit('open-venue-event', venueEvent)"
      @open-day="(date) => $emit('open-day', date)"
    />
  </div>
</template>

<style scoped lang="scss">
.calendar-body {
  width: 100%;
  display: contents;
}
</style>
