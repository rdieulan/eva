<script setup lang="ts">
import { computed } from 'vue';
import DayCell from './DayCell.vue';
import type { DayData, CalendarEvent, AvailabilityStatus } from '@shared/types';

const props = defineProps<{
  year: number;
  month: number; // 1-12
  days: Record<string, DayData>;
  editMode?: boolean;
}>();

const emit = defineEmits<{
  'prev-month': [];
  'next-month': [];
  'set-availability': [date: string, status: AvailabilityStatus | null];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
  'open-create-event': [date: string];
}>();

// Format date to YYYY-MM-DD string
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}


// Today's date string for comparison
const todayStr = computed(() => formatDateStr(new Date()));

// Check if a date is in the past (before today)
function isPastDate(dateStr: string): boolean {
  return dateStr < todayStr.value;
}

// Generate calendar grid (6 weeks x 7 days)
const calendarGrid = computed(() => {
  const grid: Array<{
    date: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPast: boolean;
    data: DayData | null;
  }> = [];

  // First day of the month
  const firstDay = new Date(props.year, props.month - 1, 1);
  // Last day of the month
  const lastDay = new Date(props.year, props.month, 0);

  // Day of week for first day (0 = Sunday, convert to Monday = 0)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6; // Sunday becomes 6

  // Days from previous month to fill
  const prevMonth = new Date(props.year, props.month - 1, 0);
  const prevMonthDays = prevMonth.getDate();

  // Fill previous month days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const date = new Date(props.year, props.month - 2, day);
    const dateStr = formatDateStr(date);
    grid.push({
      date: dateStr,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: dateStr === todayStr.value,
      isPast: isPastDate(dateStr),
      data: null,
    });
  }

  // Fill current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(props.year, props.month - 1, day);
    const dateStr = formatDateStr(date);
    grid.push({
      date: dateStr,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateStr === todayStr.value,
      isPast: isPastDate(dateStr),
      data: props.days[dateStr] ?? null,
    });
  }

  // Fill next month days to complete the grid (up to 42 cells = 6 weeks)
  const remaining = 42 - grid.length;
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(props.year, props.month, day);
    const dateStr = formatDateStr(date);
    grid.push({
      date: dateStr,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: dateStr === todayStr.value,
      isPast: isPastDate(dateStr),
      data: null,
    });
  }

  return grid;
});

function handleSetAvailability(date: string, status: AvailabilityStatus | null) {
  emit('set-availability', date, status);
}
</script>

<template>
  <div class="calendar-grid">


    <!-- Calendar grid -->
    <div class="days-grid">
      <DayCell
        v-for="cell in calendarGrid"
        :key="cell.date"
        :date="cell.date"
        :day-number="cell.dayNumber"
        :is-current-month="cell.isCurrentMonth"
        :is-today="cell.isToday"
        :is-past="cell.isPast"
        :current-user-status="cell.data?.currentUserStatus ?? null"
        :player-availabilities="cell.data?.playerAvailabilities ?? []"
        :events="cell.data?.events ?? []"
        :edit-mode="props.editMode"
        @set-availability="(status) => handleSetAvailability(cell.date, status)"
        @open-event-viewer="(events, index) => emit('open-event-viewer', events, index)"
        @open-create-event="(date) => emit('open-create-event', date)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.calendar-grid {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  width: 100%;
  max-width: 1200px;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: $spacing-xs;
  }
}


.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: $spacing-sm;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: $spacing-xs;
  }

  @include mobile {
    gap: 0.15rem;
  }

  // Prevent cells from overflowing their grid area
  :deep(.day-cell) {
    min-width: 0;
    overflow: hidden;
  }
}
</style>

