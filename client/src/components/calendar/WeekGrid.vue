<script setup lang="ts">
import DayCell from './DayCell.vue';
import WeekLayout from './layout/WeekLayout.vue';
import type { DayData, CalendarEvent, ScrimSearch, VenueEventView } from '@shared/types';
import type { WheelOpening } from './AvailabilityWheel.vue';

// A week of the team's calendar: each day in the team's reading, its number
// in the header above it rather than behind its rows
const props = defineProps<{
  year: number;
  month: number; // 1-12
  weekStart: Date; // Start of the week to display
  days: Record<string, DayData>;
  editMode?: boolean;
  matchmaking?: boolean;
  scrimSearches?: Record<string, ScrimSearch[]>; // Searches of each day
  selectable?: boolean; // Matchmaking: days can be picked for a search
  selectedDates?: string[];
  currentPlayerId?: string; // Puts the reader first in the roster of a day, in edit mode
}>();

const emit = defineEmits<{
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
  <WeekLayout :week-start="weekStart" :month="month">
    <template #day="{ day }">
      <DayCell
        :date="day.date"
        :day-number="day.dayNumber"
        :is-current-month="day.isCurrentMonth"
        :is-today="day.isToday"
        :is-past="day.isPast"
        :current-player-status="props.days[day.date]?.currentPlayerStatus ?? null"
        :current-player-hours="props.days[day.date]?.currentPlayerHours ?? null"
        :player-availabilities="props.days[day.date]?.playerAvailabilities ?? []"
        :events="props.days[day.date]?.events ?? []"
        :renewals="props.days[day.date]?.renewals ?? []"
        :venue-events="props.days[day.date]?.venueEvents ?? []"
        :show-day-number="false"
        :edit-mode="props.editMode"
        :matchmaking="props.matchmaking"
        :scrim-searches="props.scrimSearches?.[day.date] ?? []"
        :selectable="props.selectable"
        :selected="props.selectedDates?.includes(day.date) ?? false"
        :current-player-id="props.currentPlayerId"
        @open-availability="(opening) => emit('open-availability', opening)"
        @open-event-viewer="(events, index) => emit('open-event-viewer', events, index)"
        @open-create-event="(date) => emit('open-create-event', date)"
        @toggle-select="(date) => emit('toggle-select', date)"
        @open-search="(search) => emit('open-search', search)"
        @open-venue-event="(venueEvent) => emit('open-venue-event', venueEvent)"
        @open-day="(date) => emit('open-day', date)"
      />
    </template>
  </WeekLayout>
</template>
