/**
 * Composable for calendar data and navigation
 * Handles month/week navigation, data loading, and availability management
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { fetchMonthData, setAvailability as setAvailabilityApi } from '@/api/calendar.api';
import { getMonday } from '@/utils/calendar';
import type { DayData, AvailabilityStatus } from '@shared/types';

// Month names for display (French)
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export type ViewMode = 'month' | 'week';

export interface UseCalendarOptions {
  userId: Ref<string | undefined>;
}

export interface UseCalendarReturn {
  // View mode
  viewMode: Ref<ViewMode>;

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
  error: Ref<string>;

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

  // Data methods
  loadCalendarData: () => Promise<void>;
  setAvailability: (date: string, status: AvailabilityStatus | null) => Promise<void>;
}

export function useCalendar(options: UseCalendarOptions): UseCalendarReturn {
  const { userId } = options;

  // View mode state
  const viewMode = ref<ViewMode>('month');

  // Edit mode state
  const editMode = ref(false);
  let lastToggleTime = 0;

  function toggleEditMode() {
    const now = Date.now();
    if (now - lastToggleTime < 50) return; // Debounce for mobile double-event
    lastToggleTime = now;
    editMode.value = !editMode.value;
  }

  // Current month state
  const currentYear = ref(new Date().getFullYear());
  const currentMonth = ref(new Date().getMonth() + 1); // 1-12

  // Current week state (start of week - Monday)
  const currentWeekStart = ref<Date>(getMonday(new Date()));

  // Calendar data
  const days = ref<Record<string, DayData>>({});
  const isLoading = ref(true);
  const error = ref('');

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

  // Load calendar data
  async function loadCalendarData() {
    isLoading.value = true;
    error.value = '';

    try {
      const data = await fetchMonthData(monthString.value);
      days.value = data.days;
    } catch (err) {
      console.error('Error loading calendar:', err);
      error.value = err instanceof Error ? err.message : 'Erreur de chargement';
    } finally {
      isLoading.value = false;
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

  // Set availability with optimistic update
  async function setAvailability(date: string, newStatus: AvailabilityStatus | null) {
    // Store previous status for rollback
    const previousStatus = days.value[date]?.currentUserStatus ?? null;

    // Optimistic update
    if (days.value[date]) {
      days.value[date].currentUserStatus = newStatus;

      // Also update in playerAvailabilities
      const currentUserId = userId.value;
      if (currentUserId) {
        const playerAvail = days.value[date].playerAvailabilities.find(
          p => p.userId === currentUserId
        );
        if (playerAvail) {
          playerAvail.status = newStatus;
        }
      }
    }

    try {
      await setAvailabilityApi(date, newStatus);
    } catch (err) {
      console.error('Error setting availability:', err);
      // Revert on error
      if (days.value[date]) {
        days.value[date].currentUserStatus = previousStatus;
        const currentUserId = userId.value;
        if (currentUserId) {
          const playerAvail = days.value[date].playerAvailabilities.find(
            p => p.userId === currentUserId
          );
          if (playerAvail) {
            playerAvail.status = previousStatus;
          }
        }
      }
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return {
    // View mode
    viewMode,

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
    error,

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

    // Data methods
    loadCalendarData,
    setAvailability,
  };
}
