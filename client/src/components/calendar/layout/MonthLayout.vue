<script setup lang="ts">
import { computed } from 'vue';
import { monthDays, type CalendarDay } from '@/utils/calendar';

// The days of a month by week, Monday first, as a calendar lays them out: six
// weeks, the days of the months around filling the first and the last. What a
// day shows is the calendar's, in the `day` slot: the team's (see
// CalendarGrid), or a venue's (see VenueCalendar).
const props = defineProps<{
  year: number;
  month: number; // 1-12
}>();

defineSlots<{
  day(props: { day: CalendarDay }): unknown;
}>();

const days = computed(() => monthDays(props.year, props.month));
</script>

<template>
  <div class="calendar-grid">
    <div class="days-grid">
      <template v-for="day in days" :key="day.date">
        <slot name="day" :day="day" />
      </template>
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
  // minmax(0, 1fr), not 1fr: a column must not grow to fit a long title
  grid-template-columns: repeat(7, minmax(0, 1fr));
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
