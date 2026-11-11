<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { WEEKDAY_NAMES } from '@/constants/calendar';
import { weekDays, type CalendarDay } from '@/utils/calendar';

// The seven days of a week, Monday first, each under its name and number, as
// a calendar lays them out: side by side, one under the other on a phone,
// where today is scrolled into sight. What a day shows is the calendar's, in
// the `day` slot: the team's (see WeekGrid), or a venue's (see VenueCalendar).
const props = defineProps<{
  weekStart: Date; // Its Monday
  month: number; // 1-12, the month in sight: the days of the others are told apart
}>();

defineSlots<{
  day(props: { day: CalendarDay }): unknown;
}>();

const days = computed(() => weekDays(props.weekStart, props.month));

const weekDaysRef = ref<HTMLElement | null>(null);

// On a phone, where the days are one under the other: today in sight, within
// the box that scrolls the calendar
function scrollToToday() {
  if (!weekDaysRef.value) return;
  if (window.innerWidth > 768) return;

  const todayElement = weekDaysRef.value.querySelector('.is-today') as HTMLElement;
  if (todayElement) {
    const scrollContainer = weekDaysRef.value.closest('.calendar-content');
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = todayElement.getBoundingClientRect();
      scrollContainer.scrollTop = scrollContainer.scrollTop + elementRect.top - containerRect.top;
    }
  }
}

onMounted(() => {
  nextTick(scrollToToday);
});

watch(() => props.weekStart, () => {
  nextTick(scrollToToday);
});
</script>

<template>
  <div class="week-grid">
    <div ref="weekDaysRef" class="week-days">
      <div
        v-for="(day, index) in days"
        :key="day.date"
        class="week-day-column"
        :class="{ 'is-today': day.isToday }"
      >
        <div class="week-day-header">
          <span class="day-name">{{ WEEKDAY_NAMES[index] }}</span>
          <span class="day-number" :class="{ 'other-month': !day.isCurrentMonth }">
            {{ day.dayNumber }}
          </span>
        </div>
        <slot name="day" :day="day" />
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

  // A day keeps the height every day has (see DayCell): a week reads like a
  // row of the month, and switching between the two moves nothing. On a
  // phone, the day takes the width beside its header.
  :deep(.day-cell) {
    @include mobile-lg {
      flex: 1;
      flex-direction: row;
      align-items: stretch;
    }
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
</style>
