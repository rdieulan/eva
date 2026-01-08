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

// Month names in French
const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Day names
const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Format date to YYYY-MM-DD string
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Current month display
const monthDisplay = computed(() => `${monthNames[props.month - 1]} ${props.year}`);

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
    <!-- Header with navigation -->
    <div class="calendar-header">
      <button class="nav-btn" @click="emit('prev-month')" title="Mois précédent">
        <svg viewBox="0 0 24 24" class="nav-icon">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
      <h2 class="month-title">{{ monthDisplay }}</h2>
      <button class="nav-btn" @click="emit('next-month')" title="Mois suivant">
        <svg viewBox="0 0 24 24" class="nav-icon">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>
    </div>

    <!-- Day names header -->
    <div class="weekdays-header">
      <div v-for="dayName in dayNames" :key="dayName" class="weekday-name">
        {{ dayName }}
      </div>
    </div>

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
  gap: $spacing-md;
  width: 100%;
  max-width: 1200px;

  @include tablet {
    gap: 0.75rem;
  }

  @include mobile-lg {
    gap: $spacing-sm;
  }
}

.calendar-header {
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

.month-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #fff;
  min-width: 200px;
  text-align: center;

  @include tablet {
    font-size: 1.25rem;
    min-width: 180px;
  }

  @include mobile-lg {
    font-size: 1.1rem;
    min-width: 150px;
  }

  @include mobile {
    font-size: 1rem;
    min-width: 120px;
  }
}

.nav-btn {
  width: 40px;
  height: 40px;
  border: 1px solid $color-border-light;
  background: $color-bg-tertiary;
  border-radius: $radius-md;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    border-color: $color-accent;
  }

  @include mobile-lg {
    width: 36px;
    height: 36px;
    padding: 6px;
  }

  @include mobile {
    width: 32px;
    height: 32px;
    padding: 4px;
    border-radius: 6px;
  }
}

.nav-icon {
  width: 24px;
  height: 24px;
  fill: $color-text-secondary;

  .nav-btn:hover & {
    fill: #fff;
  }

  @include mobile-lg {
    width: 20px;
    height: 20px;
  }

  @include mobile {
    width: 18px;
    height: 18px;
  }
}

.weekdays-header,
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
}

.days-grid {
  // Prevent cells from overflowing their grid area
  :deep(.day-cell) {
    min-width: 0;
    overflow: hidden;
  }
}

.weekday-name {
  text-align: center;
  font-weight: 600;
  font-size: 0.85rem;
  color: $color-accent;
  padding: $spacing-sm;

  @include mobile-lg {
    font-size: 0.7rem;
    padding: $spacing-xs;
  }

  @include mobile {
    font-size: 0.65rem;
    padding: 0.2rem;
  }
}
</style>

