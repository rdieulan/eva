<script setup lang="ts">
import DayCell from './DayCell.vue';
import MonthLayout from './layout/MonthLayout.vue';
import type { CalendarDay } from '@/utils/calendar';
import type { DayData, CalendarEvent, ScrimSearch, VenueEventView } from '@shared/types';
import type { WheelOpening } from './AvailabilityWheel.vue';

// A month of the team's calendar: each day in the team's reading, its days
// alone; the days of the months around only fill its weeks
const props = defineProps<{
  year: number;
  month: number; // 1-12
  days: Record<string, DayData>;
  editMode?: boolean;
  matchmaking?: boolean;
  scrimSearches?: Record<string, ScrimSearch[]>; // Searches of each day
  selectable?: boolean; // Matchmaking: days can be picked for a search
  selectedDates?: string[];
  currentPlayerId?: string; // Puts the reader first in the roster of a day, in edit mode
}>();

const emit = defineEmits<{
  'prev-month': [];
  'next-month': [];
  'open-availability': [opening: WheelOpening];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
  'open-create-event': [date: string];
  'toggle-select': [date: string];
  'open-search': [search: ScrimSearch];
  'open-venue-event': [event: VenueEventView];
  'open-day': [date: string];
}>();

// What the calendar loaded for a day of the month; nothing for the days around it
function dataOf(day: CalendarDay): DayData | null {
  return day.isCurrentMonth ? props.days[day.date] ?? null : null;
}
</script>

<template>
  <MonthLayout :year="year" :month="month">
    <template #day="{ day }">
      <DayCell
        :date="day.date"
        :day-number="day.dayNumber"
        :is-current-month="day.isCurrentMonth"
        :is-today="day.isToday"
        :is-past="day.isPast"
        :current-player-status="dataOf(day)?.currentPlayerStatus ?? null"
        :current-player-hours="dataOf(day)?.currentPlayerHours ?? null"
        :player-availabilities="dataOf(day)?.playerAvailabilities ?? []"
        :events="dataOf(day)?.events ?? []"
        :renewals="dataOf(day)?.renewals ?? []"
        :venue-events="dataOf(day)?.venueEvents ?? []"
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
  </MonthLayout>
</template>
