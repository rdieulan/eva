/**
 * The way through a calendar, whoever's it is: the month or the week in
 * sight, its title, and the steps to the one before or after. The team's
 * calendar (see useCalendar) and a venue's (see VenueCalendar) move alike.
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { getMonday } from '@/utils/calendar';
import { MONTH_NAMES } from '@/constants/calendar';

export type ViewMode = 'month' | 'week';

// The month of a day, YYYY-MM
function monthOf(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

export interface UseCalendarNavigationReturn {
  viewMode: Ref<ViewMode>;

  // Month state
  currentYear: Ref<number>;
  currentMonth: Ref<number>; // 1-12
  monthString: ComputedRef<string>; // YYYY-MM
  monthDisplay: ComputedRef<string>;

  // Week state
  currentWeekStart: Ref<Date>; // Its Monday
  weekDisplay: ComputedRef<string>;

  // The title of what is in sight, month or week
  navigationTitle: ComputedRef<string>;
  // The months the days in sight belong to (YYYY-MM), in order: the month
  // shown, or the one or two a week spans, all of whose days are in sight
  monthsInSight: ComputedRef<string[]>;

  goToPrev: () => void;
  goToNext: () => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToDate: (date: string) => void;
}

export function useCalendarNavigation(): UseCalendarNavigationReturn {
  const viewMode = ref<ViewMode>('month');

  // Current month state
  const currentYear = ref(new Date().getFullYear());
  const currentMonth = ref(new Date().getMonth() + 1); // 1-12

  // Current week state (start of week - Monday)
  const currentWeekStart = ref<Date>(getMonday(new Date()));

  // Month string for API (YYYY-MM)
  const monthString = computed(() => {
    const m = currentMonth.value.toString().padStart(2, '0');
    return `${currentYear.value}-${m}`;
  });

  // Month display title
  const monthDisplay = computed(() => {
    return `${MONTH_NAMES[currentMonth.value - 1]} ${currentYear.value}`;
  });

  // Week display title
  const weekDisplay = computed(() => {
    const start = currentWeekStart.value;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = MONTH_NAMES[start.getMonth()];
    const endMonth = MONTH_NAMES[end.getMonth()];

    if (start.getMonth() === end.getMonth()) {
      return `${startDay} - ${endDay} ${startMonth} ${start.getFullYear()}`;
    } else if (start.getFullYear() === end.getFullYear()) {
      return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${start.getFullYear()}`;
    } else {
      return `${startDay} ${startMonth} ${start.getFullYear()} - ${endDay} ${endMonth} ${end.getFullYear()}`;
    }
  });

  // Navigation title based on view mode
  const navigationTitle = computed(() => {
    return viewMode.value === 'month' ? monthDisplay.value : weekDisplay.value;
  });

  const monthsInSight = computed(() => {
    if (viewMode.value === 'month') return [monthString.value];
    const end = new Date(currentWeekStart.value);
    end.setDate(end.getDate() + 6);
    return [...new Set([monthOf(currentWeekStart.value), monthOf(end)])];
  });

  // Watch view mode changes
  watch(viewMode, (newMode) => {
    if (newMode === 'week') {
      syncWeekToMonth();
    }
  });

  // Month navigation
  function goToPrevMonth() {
    if (currentMonth.value === 1) {
      currentMonth.value = 12;
      currentYear.value--;
    } else {
      currentMonth.value--;
    }
  }

  function goToNextMonth() {
    if (currentMonth.value === 12) {
      currentMonth.value = 1;
      currentYear.value++;
    } else {
      currentMonth.value++;
    }
  }

  // Week navigation
  function goToPrevWeek() {
    const newDate = new Date(currentWeekStart.value);
    newDate.setDate(newDate.getDate() - 7);
    currentWeekStart.value = newDate;
    updateMonthFromWeek();
  }

  function goToNextWeek() {
    const newDate = new Date(currentWeekStart.value);
    newDate.setDate(newDate.getDate() + 7);
    currentWeekStart.value = newDate;
    updateMonthFromWeek();
  }

  // Sync month/year when week changes
  function updateMonthFromWeek() {
    const midWeek = new Date(currentWeekStart.value);
    midWeek.setDate(midWeek.getDate() + 3); // Wednesday (middle of week)
    currentYear.value = midWeek.getFullYear();
    currentMonth.value = midWeek.getMonth() + 1;
  }

  // Sync week when switching to week view
  function syncWeekToMonth() {
    const today = new Date();
    // Only sync to current week if viewing current month
    if (currentYear.value === today.getFullYear() && currentMonth.value === today.getMonth() + 1) {
      currentWeekStart.value = getMonday(today);
    } else {
      // If viewing a different month, show the first week of that month
      const firstOfMonth = new Date(currentYear.value, currentMonth.value - 1, 1);
      currentWeekStart.value = getMonday(firstOfMonth);
    }
  }

  // Show the month of a day (YYYY-MM-DD), or its week in the week view
  function goToDate(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    if (viewMode.value === 'week') {
      currentWeekStart.value = getMonday(new Date(year!, month! - 1, day!));
      updateMonthFromWeek();
      return;
    }
    currentYear.value = year!;
    currentMonth.value = month!;
  }

  // Generic navigation based on view mode
  function goToPrev() {
    if (viewMode.value === 'month') {
      goToPrevMonth();
    } else {
      goToPrevWeek();
    }
  }

  function goToNext() {
    if (viewMode.value === 'month') {
      goToNextMonth();
    } else {
      goToNextWeek();
    }
  }

  return {
    viewMode,
    currentYear,
    currentMonth,
    monthString,
    monthDisplay,
    currentWeekStart,
    weekDisplay,
    navigationTitle,
    monthsInSight,
    goToPrev,
    goToNext,
    goToPrevMonth,
    goToNextMonth,
    goToPrevWeek,
    goToNextWeek,
    goToDate,
  };
}
