<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue';
import DayCell from './DayCell.vue';
import type { DayData, CalendarEvent, AvailabilityStatus } from '@shared/types';

const props = defineProps<{
  year: number;
  month: number; // 1-12
  weekStart: Date; // Start of the week to display
  days: Record<string, DayData>;
  editMode?: boolean;
}>();

const emit = defineEmits<{
  'prev-week': [];
  'next-week': [];
  'set-availability': [date: string, status: AvailabilityStatus | null];
  'open-event-viewer': [events: CalendarEvent[], initialIndex: number];
  'open-create-event': [date: string];
}>();

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

function handleSetAvailability(date: string, status: AvailabilityStatus | null) {
  emit('set-availability', date, status);
}

// Ref for the week days container
const weekDaysRef = ref<HTMLElement | null>(null);

// Scroll to current day on mobile
function scrollToToday() {
  if (!weekDaysRef.value) return;

  // Only on mobile (vertical layout)
  if (window.innerWidth > 768) return;

  const todayElement = weekDaysRef.value.querySelector('.is-today') as HTMLElement;
  if (todayElement) {
    // Scroll within the parent scrollable container
    const scrollContainer = weekDaysRef.value.closest('.calendar-content');
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = todayElement.getBoundingClientRect();
      const scrollTop = scrollContainer.scrollTop + elementRect.top - containerRect.top;
      scrollContainer.scrollTop = scrollTop;
    }
  }
}

// Scroll to today on mount and when week changes
onMounted(() => {
  nextTick(scrollToToday);
});

watch(() => props.weekStart, () => {
  nextTick(scrollToToday);
});
</script>

<template>
  <div class="week-grid">

    <!-- Week days -->
    <div class="week-days" ref="weekDaysRef">
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
          :edit-mode="props.editMode"
          @set-availability="(status) => handleSetAvailability(cell.date, status)"
          @open-event-viewer="(events, index) => emit('open-event-viewer', events, index)"
          @open-create-event="(date) => emit('open-create-event', date)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.week-grid {
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


.week-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: $spacing-sm;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    grid-template-columns: 1fr;
    gap: $spacing-sm;
  }

  @include mobile {
    gap: 0.35rem;
  }
}

.week-day-column {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  &.is-today .week-day-header {
    background: rgba($color-accent, 0.2);
    border-color: $color-accent;
  }

  @include mobile-lg {
    flex-direction: row;
    gap: $spacing-sm;
  }

  @include mobile {
    gap: 0.35rem;
  }
}

.week-day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-sm;
  background: rgba($color-bg-tertiary, 0.5);
  border: 1px solid $color-border-light;
  border-radius: $radius-md;

  @include tablet {
    padding: 0.4rem;
  }

  @include mobile-lg {
    min-width: 80px;
    justify-content: center;
    border-radius: 6px;
    padding: $spacing-sm;
  }

  @include mobile {
    min-width: 65px;
    padding: 0.35rem;
  }
}

.day-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: $color-accent;

  @include tablet {
    font-size: 0.75rem;
  }

  @include mobile-lg {
    font-size: 0.7rem;
  }

  @include mobile {
    font-size: 0.6rem;
  }
}

.day-number {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;

  &.other-month {
    color: #555;
  }

  @include tablet {
    font-size: 1.1rem;
  }

  @include mobile-lg {
    font-size: 1rem;
  }

  @include mobile {
    font-size: 0.9rem;
  }
}

.week-day-cell {
  min-height: 200px;

  @include mobile-lg {
    flex: 1;
    min-height: 80px;
  }

  @include mobile {
    min-height: 70px;
  }
}

:deep(.day-cell) {
  min-height: 200px;

  @include tablet {
    min-height: 160px;
  }

  @include mobile-lg {
    min-height: 80px;
    // Switch to row layout for week view on mobile
    flex-direction: row;
    align-items: stretch;
  }

  @include mobile {
    min-height: 70px;
  }
}

// Week view mobile: reorganize DayCell content
@include mobile-lg {
  :deep(.day-cell) {
    // Main content area (events)
    .events-list {
      flex: 1;
      justify-content: center;
    }

    // Player summary on right side, vertical
    .players-summary {
      flex-direction: column;
      flex-wrap: nowrap;
      margin-top: 0;
      margin-left: auto;
      justify-content: center;
      gap: 2px;
      padding-left: 0.25rem;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
    }

    // Hide day header (already shown in week-day-header)
    .day-header {
      display: none;
    }
  }
}

@include mobile {
  :deep(.day-cell) {
    .players-summary {
      gap: 2px;
      padding-left: 0.2rem;
    }

    // Keep same size as mobile-lg with visible initials
    .player-avatar {
      width: 16px;
      height: 16px;
      font-size: 0.45rem;
    }
  }
}
</style>

