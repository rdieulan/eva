/**
 * Composable for the team's calendar: its data, the availability of its
 * players, and the way through it (see useCalendarNavigation)
 */

import { ref, watch, type Ref } from 'vue';
import { fetchMonthData, setAvailability as setAvailabilityApi } from '@/api/calendar.api';
import { useErrors } from '@/composables/useErrors';
import { useCalendarNavigation, type UseCalendarNavigationReturn } from '@/composables/useCalendarNavigation';
import { ERROR } from '@shared/constants';
import type { DayData, AvailabilityHours, AvailabilityStatus } from '@shared/types';

// The team's own calendar, or the same days read for matchmaking: coloured by
// the team's lineup, with the slots of a venue
export type CalendarMode = 'team' | 'matchmaking';

export interface UseCalendarOptions {
  playerId: Ref<string | undefined>;
  onError?: (errors: string[]) => void;
}

export interface UseCalendarReturn extends UseCalendarNavigationReturn {
  calendarMode: Ref<CalendarMode>;

  // Data
  days: Ref<Record<string, DayData>>;
  isLoading: Ref<boolean>;
  errors: Ref<string[]>;
  noTeam: Ref<boolean>;

  // Edit mode
  editMode: Ref<boolean>;
  toggleEditMode: () => void;

  // Data methods
  loadCalendarData: () => Promise<void>;
  setAvailability: (date: string, status: AvailabilityStatus | null, hours?: AvailabilityHours | null) => Promise<void>;
}

export function useCalendar(options: UseCalendarOptions): UseCalendarReturn {
  const { playerId, onError } = options;

  const navigation = useCalendarNavigation();
  const { currentYear, currentMonth, monthString } = navigation;

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

  // Calendar data
  const days = ref<Record<string, DayData>>({});
  const isLoading = ref(true);
  const { errors, clearErrors, setErrorFromException } = useErrors();
  const noTeam = ref(false);

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
    ...navigation,
    calendarMode,

    // Data
    days,
    isLoading,
    errors,
    noTeam,

    // Edit mode
    editMode,
    toggleEditMode,

    // Data methods
    loadCalendarData,
    setAvailability,
  };
}
