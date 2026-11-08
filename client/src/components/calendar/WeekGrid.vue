<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue';
import DayCell from './DayCell.vue';
import { formatDateStr, isPastDateStr } from '@/utils/calendar';
import type { DayData, CalendarEvent, ScrimSearch } from '@shared/types';
import type { WheelOpening } from './AvailabilityWheel.vue';

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
  'open-day': [date: string];
}>();

// Day names (full) - tuple type for type safety
const dayNamesFull: [string, string, string, string, string, string, string] = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
];

// Today's date string for comparison
const todayStr = computed(() => formatDateStr(new Date()));

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
      isPast: isPastDateStr(dateStr),
      data: props.days[dateStr] ?? null,
    });
  }

  return grid;
});

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
      scrollContainer.scrollTop = scrollContainer.scrollTop + elementRect.top - containerRect.top;
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
          :current-player-status="cell.data?.currentPlayerStatus ?? null"
          :current-player-hours="cell.data?.currentPlayerHours ?? null"
          :player-availabilities="cell.data?.playerAvailabilities ?? []"
          :events="cell.data?.events ?? []"
          :renewals="cell.data?.renewals ?? []"
          class="week-day-cell"
          :show-day-number="false"
          :edit-mode="props.editMode"
          :matchmaking="props.matchmaking"
          :scrim-searches="props.scrimSearches?.[cell.date] ?? []"
          :selectable="props.selectable"
          :selected="props.selectedDates?.includes(cell.date) ?? false"
          :current-player-id="props.currentPlayerId"
          @open-availability="(opening) => emit('open-availability', opening)"
          @open-event-viewer="(events, index) => emit('open-event-viewer', events, index)"
          @open-create-event="(date) => emit('open-create-event', date)"
          @toggle-select="(date) => emit('toggle-select', date)"
          @open-search="(search) => emit('open-search', search)"
          @open-day="(date) => emit('open-day', date)"
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
  // minmax(0, 1fr), not 1fr: a column must not grow to fit a long title
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: $spacing-sm;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    grid-template-columns: minmax(0, 1fr);
    gap: $spacing-sm;
  }

  @include mobile {
    gap: 0.35rem;
  }
}

.week-day-column {
  display: flex;
  flex-direction: column;
  min-width: 0; // A grid item: may shrink below the width of its titles
  gap: $spacing-sm;

  &.is-today .week-day-header {
    background: with-alpha($color-accent, 0.2);
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
  background: with-alpha($color-bg-tertiary, 0.5);
  border: $border-thin solid $color-border-light;
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
  color: $color-white;

  &.other-month {
    color: $color-text-secondary;
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

// A day keeps the height every day has (see DayCell): a week reads like a row
// of the month, and switching between the two moves nothing
.week-day-cell {
  @include mobile-lg {
    flex: 1;
  }
}

:deep(.day-cell) {
  @include mobile-lg {
    // Switch to row layout for week view on mobile
    flex-direction: row;
    align-items: stretch;
  }
}

// Week view mobile: the day header is already shown in week-day-header
@include mobile-lg {
  :deep(.day-cell) {
    .day-header {
      display: none;
    }
  }
}
</style>

