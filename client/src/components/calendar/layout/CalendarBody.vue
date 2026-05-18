<script setup lang="ts">
/**
 * CalendarBody - Layout component
 * Wrapper for the main calendar content area.
 * Contains CalendarGrid or WeekGrid based on view mode.
 */
import CalendarGrid from '@/components/calendar/CalendarGrid.vue';
import WeekGrid from '@/components/calendar/WeekGrid.vue';
import type { DayData, CalendarEvent, AvailabilityStatus } from '@shared/types';

defineProps<{
  viewMode: 'month' | 'week';
  year: number;
  month: number;
  weekStart: Date;
  days: Record<string, DayData>;
  editMode: boolean;
}>();

defineEmits<{
  'prev-month': [];
  'next-month': [];
  'prev-week': [];
  'next-week': [];
  'set-availability': [date: string, status: AvailabilityStatus | null];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
  'open-create-event': [date: string];
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
      @prev-month="$emit('prev-month')"
      @next-month="$emit('next-month')"
      @set-availability="(date, status) => $emit('set-availability', date, status)"
      @open-event-viewer="(events, idx) => $emit('open-event-viewer', events, idx)"
      @open-create-event="(date) => $emit('open-create-event', date)"
    />

    <!-- Week view -->
    <WeekGrid
      v-else
      :year="year"
      :month="month"
      :week-start="weekStart"
      :days="days"
      :edit-mode="editMode"
      @prev-week="$emit('prev-week')"
      @next-week="$emit('next-week')"
      @set-availability="(date, status) => $emit('set-availability', date, status)"
      @open-event-viewer="(events, idx) => $emit('open-event-viewer', events, idx)"
      @open-create-event="(date) => $emit('open-create-event', date)"
    />
  </div>
</template>

<style scoped lang="scss">
.calendar-body {
  width: 100%;
  display: contents;
}
</style>
