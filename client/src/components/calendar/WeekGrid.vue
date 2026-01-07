<script setup lang="ts">
import { computed } from 'vue';
import DayCell from './DayCell.vue';
import type { DayData, CalendarEvent, AvailabilityStatus } from '@shared/types';

const props = defineProps<{
  year: number;
  month: number; // 1-12
  weekStart: Date; // Start of the week to display
  days: Record<string, DayData>;
}>();

const emit = defineEmits<{
  'prev-week': [];
  'next-week': [];
  'toggle-availability': [date: string, currentStatus: AvailabilityStatus | null];
  'click-day': [date: string];
  'click-event': [event: CalendarEvent];
}>();

// Month names in French
const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Day names (full) - tuple type for type safety
const dayNamesFull: [string, string, string, string, string, string, string] = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
];

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

// Week display title
const weekDisplay = computed(() => {
  const start = props.weekStart;
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = monthNames[start.getMonth()];
  const endMonth = monthNames[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startDay} - ${endDay} ${startMonth} ${start.getFullYear()}`;
  } else if (start.getFullYear() === end.getFullYear()) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${start.getFullYear()}`;
  } else {
    return `${startDay} ${startMonth} ${start.getFullYear()} - ${endDay} ${endMonth} ${end.getFullYear()}`;
  }
});

// Generate week grid (7 days)
const weekGrid = computed(() => {
  const grid: Array<{
    date: string;
    dayNumber: number;
    dayName: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPast: boolean;
    data: DayData | null;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(props.weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = formatDateStr(date);

    grid.push({
      date: dateStr,
      dayNumber: date.getDate(),
      dayName: dayNamesFull[i as 0 | 1 | 2 | 3 | 4 | 5 | 6],
      isCurrentMonth: date.getMonth() + 1 === props.month,
      isToday: dateStr === todayStr.value,
      isPast: isPastDate(dateStr),
      data: props.days[dateStr] ?? null,
    });
  }

  return grid;
});

function handleToggleAvailability(date: string, currentStatus: AvailabilityStatus | null) {
  emit('toggle-availability', date, currentStatus);
}
</script>

<template>
  <div class="week-grid">
    <!-- Header with navigation -->
    <div class="week-header">
      <button class="nav-btn" @click="emit('prev-week')" title="Semaine précédente">
        <svg viewBox="0 0 24 24" class="nav-icon">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
      <h2 class="week-title">{{ weekDisplay }}</h2>
      <button class="nav-btn" @click="emit('next-week')" title="Semaine suivante">
        <svg viewBox="0 0 24 24" class="nav-icon">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>
    </div>

    <!-- Week days -->
    <div class="week-days">
      <div
        v-for="cell in weekGrid"
        :key="cell.date"
        class="week-day-column"
        :class="{ 'is-today': cell.isToday }"
      >
        <div class="week-day-header">
          <span class="day-name">{{ cell.dayName }}</span>
          <span class="day-number" :class="{ 'other-month': !cell.isCurrentMonth }">
            {{ cell.dayNumber }}
          </span>
        </div>
        <DayCell
          :date="cell.date"
          :day-number="cell.dayNumber"
          :is-current-month="cell.isCurrentMonth"
          :is-today="cell.isToday"
          :is-past="cell.isPast"
          :current-user-status="cell.data?.currentUserStatus ?? null"
          :player-availabilities="cell.data?.playerAvailabilities ?? []"
          :events="cell.data?.events ?? []"
          class="week-day-cell"
          :show-day-number="false"
          @toggle-availability="handleToggleAvailability(cell.date, cell.data?.currentUserStatus ?? null)"
          @click-day="emit('click-day', cell.date)"
          @click-event="emit('click-event', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.week-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 1200px;
}

.week-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.week-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
  min-width: 300px;
  text-align: center;
}

.nav-btn {
  width: 40px;
  height: 40px;
  border: 1px solid #3a3a5a;
  background: #2a2a4a;
  border-radius: 8px;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: #3a3a5a;
  border-color: #7a7aba;
}

.nav-icon {
  width: 24px;
  height: 24px;
  fill: #888;
}

.nav-btn:hover .nav-icon {
  fill: #fff;
}

.week-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.week-day-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.week-day-column.is-today .week-day-header {
  background: rgba(122, 122, 186, 0.2);
  border-color: #7a7aba;
}

.week-day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  background: rgba(42, 42, 74, 0.5);
  border: 1px solid #3a3a5a;
  border-radius: 8px;
}

.day-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #7a7aba;
}

.day-number {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
}

.day-number.other-month {
  color: #555;
}

.week-day-cell {
  min-height: 200px;
}

/* Override DayCell styles for week view */
:deep(.day-cell) {
  min-height: 200px;
}
</style>

