/**
 * Composable for calendar data and navigation
 * Handles month/week navigation, data loading, and availability management
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { fetchMonthData, setAvailability as setAvailabilityApi } from '@/api/calendar.api';
import { getMonday } from '@/utils/calendar';
import { useErrors } from '@/composables/useErrors';
import { MONTH_NAMES } from '@/constants/calendar';
import { ERROR } from '@shared/constants';
import type { DayData, AvailabilityHours, AvailabilityStatus } from '@shared/types';


export type ViewMode = 'month' | 'week';

// The team's own calendar, or the same days read for matchmaking: coloured by
// the team's lineup, with the slots of a venue
export type CalendarMode = 'team' | 'matchmaking';

export interface UseCalendarOptions {
  playerId: Ref<string | undefined>;
  onError?: (errors: string[]) => void;
}

export interface UseCalendarReturn {
  // View mode
  viewMode: Ref<ViewMode>;
  calendarMode: Ref<CalendarMode>;

  // Month state
  currentYear: Ref<number>;
  currentMonth: Ref<number>;
  monthString: ComputedRef<string>;
  monthDisplay: ComputedRef<string>;

  // Week state
  currentWeekStart: Ref<Date>;
  weekDisplay: ComputedRef<string>;

  // Navigation display
  navigationTitle: ComputedRef<string>;

  // Data
  days: Ref<Record<string, DayData>>;
  isLoading: Ref<boolean>;
  errors: Ref<string[]>;
  noTeam: Ref<boolean>;

  // Edit mode
  editMode: Ref<boolean>;
  toggleEditMode: () => void;

  // Navigation methods
  goToPrev: () => void;
  goToNext: () => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToDate: (date: string) => void;

  // Data methods
  loadCalendarData: () => Promise<void>;
  setAvailability: (date: string, status: AvailabilityStatus | null, hours?: AvailabilityHours | null) => Promise<void>;
}

export function useCalendar(options: UseCalendarOptions): UseCalendarReturn {
  const { playerId, onError } = options;

  // View mode state
  const viewMode = ref<ViewMode>('month');
  const calendarMode = ref<CalendarMode>('team');

  // Edit mode state
  const editMode = ref(false);
  let lastToggleTime = 0;

  function toggleEditMode() {
    const now = Date.now();
    if (now - lastToggleTime < 50) return; // Debounce for mobile double-event
    lastToggleTime = now;
    editMode.value = !editMode.value;
  }

  // A player edits their own days; matchmaking reads the team's, so editing stops there
  watch(calendarMode, mode => {
    if (mode === 'matchmaking') editMode.value = false;
  });

  // Current month state
  const currentYear = ref(new Date().getFullYear());
  const currentMonth = ref(new Date().getMonth() + 1); // 1-12

  // Current week state (start of week - Monday)
  const currentWeekStart = ref<Date>(getMonday(new Date()));

  // Calendar data
  const days = ref<Record<string, DayData>>({});
  const isLoading = ref(true);
  const { errors, clearErrors, setErrorFromException } = useErrors();
  const noTeam = ref(false);

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

  // Load calendar data. An answer that arrives after another month was asked
  // for is dropped: it would show the wrong month.
  let loadRequestId = 0;

  async function loadCalendarData() {
    const requestId = ++loadRequestId;
    isLoading.value = true;
    clearErrors();

    try {
      const data = await fetchMonthData(monthString.value);
      if (requestId !== loadRequestId) return;
      days.value = data.days;
      noTeam.value = data.noTeam === true;
    } catch (err) {
      if (requestId !== loadRequestId) return;
      console.error('Error loading calendar:', err);
      setErrorFromException(err, ERROR.serverError);
    } finally {
      if (requestId === loadRequestId) isLoading.value = false;
    }
  }

  // Watch month changes to reload data
  watch([currentYear, currentMonth], () => {
    loadCalendarData();
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

  // The reader's answer for a day, in the day itself and in its roster
  function applyAvailability(date: string, status: AvailabilityStatus | null, hours: AvailabilityHours | null) {
    const day = days.value[date];
    if (!day) return;
    day.currentPlayerStatus = status;
    day.currentPlayerHours = hours;
    const own = day.playerAvailabilities.find(player => player.playerId === playerId.value);
    if (own) {
      own.status = status;
      own.hours = hours;
    }
  }

  // A refused answer is told on its own: the errors of the calendar are those
  // of its loading, which put an error screen in place of the days
  const answerErrors = useErrors();

  // Set availability with optimistic update: the day shows the answer at once,
  // and goes back to the one before when the server refuses it. Hours go with
  // a partial availability only.
  async function setAvailability(date: string, newStatus: AvailabilityStatus | null, hours: AvailabilityHours | null = null) {
    const previousStatus = days.value[date]?.currentPlayerStatus ?? null;
    const previousHours = days.value[date]?.currentPlayerHours ?? null;
    const newHours = newStatus === 'PARTIAL' ? hours : null;
    applyAvailability(date, newStatus, newHours);

    try {
      await setAvailabilityApi(date, newStatus, newHours);
    } catch (err) {
      console.error('Error setting availability:', err);
      applyAvailability(date, previousStatus, previousHours);
      answerErrors.setErrorFromException(err, ERROR.availabilityUpdateFailed);
      onError?.(answerErrors.errors.value);
    }
  }

  return {
    // View mode
    viewMode,
    calendarMode,

    // Month state
    currentYear,
    currentMonth,
    monthString,
    monthDisplay,

    // Week state
    currentWeekStart,
    weekDisplay,

    // Navigation display
    navigationTitle,

    // Data
    days,
    isLoading,
    errors,
    noTeam,

    // Edit mode
    editMode,
    toggleEditMode,

    // Navigation methods
    goToPrev,
    goToNext,
    goToPrevMonth,
    goToNextMonth,
    goToPrevWeek,
    goToNextWeek,
    goToDate,

    // Data methods
    loadCalendarData,
    setAvailability,
  };
}
