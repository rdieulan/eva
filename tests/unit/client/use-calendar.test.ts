/**
 * Tests for useCalendar composable
 * Tests navigation logic, computed properties, and state management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useCalendar } from '@/composables/useCalendar';

// Mock the API calls
vi.mock('@/api/calendar.api', () => ({
  fetchMonthData: vi.fn().mockResolvedValue({ days: {} }),
  setAvailability: vi.fn().mockResolvedValue({}),
}));

// Mock getMonday utility
vi.mock('@/utils/calendar', () => ({
  getMonday: vi.fn((date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }),
}));

describe('useCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Month Navigation', () => {
    it('should navigate to next month within same year', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentMonth, currentYear, goToNextMonth } = useCalendar({ playerId });

      currentMonth.value = 5;
      currentYear.value = 2026;
      goToNextMonth();

      expect(currentMonth.value).toBe(6);
      expect(currentYear.value).toBe(2026);
    });

    it('should navigate to next year when going from December', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentMonth, currentYear, goToNextMonth } = useCalendar({ playerId });

      currentMonth.value = 12;
      currentYear.value = 2026;
      goToNextMonth();

      expect(currentMonth.value).toBe(1);
      expect(currentYear.value).toBe(2027);
    });

    it('should navigate to previous month within same year', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentMonth, currentYear, goToPrevMonth } = useCalendar({ playerId });

      currentMonth.value = 5;
      currentYear.value = 2026;
      goToPrevMonth();

      expect(currentMonth.value).toBe(4);
      expect(currentYear.value).toBe(2026);
    });

    it('should navigate to previous year when going from January', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentMonth, currentYear, goToPrevMonth } = useCalendar({ playerId });

      currentMonth.value = 1;
      currentYear.value = 2026;
      goToPrevMonth();

      expect(currentMonth.value).toBe(12);
      expect(currentYear.value).toBe(2025);
    });
  });

  describe('Computed Properties', () => {
    it('should format monthString correctly', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentMonth, currentYear, monthString } = useCalendar({ playerId });

      currentMonth.value = 1;
      currentYear.value = 2026;
      expect(monthString.value).toBe('2026-01');

      currentMonth.value = 12;
      expect(monthString.value).toBe('2026-12');
    });

    it('should format monthDisplay in French', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentMonth, currentYear, monthDisplay } = useCalendar({ playerId });

      currentMonth.value = 1;
      currentYear.value = 2026;
      expect(monthDisplay.value).toBe('Janvier 2026');

      currentMonth.value = 7;
      expect(monthDisplay.value).toBe('Juillet 2026');
    });

    it('should return navigationTitle based on viewMode', () => {
      const playerId = ref<string | undefined>('player-1');
      const { viewMode, currentMonth, currentYear, navigationTitle, monthDisplay } = useCalendar({ playerId });

      currentMonth.value = 3;
      currentYear.value = 2026;
      viewMode.value = 'month';

      expect(navigationTitle.value).toBe(monthDisplay.value);
    });
  });

  describe('Edit Mode', () => {
    it('should toggle edit mode', async () => {
      const playerId = ref<string | undefined>('player-1');
      const { editMode, toggleEditMode } = useCalendar({ playerId });

      expect(editMode.value).toBe(false);
      toggleEditMode();
      expect(editMode.value).toBe(true);

      // Wait for debounce (50ms)
      await new Promise(resolve => setTimeout(resolve, 60));

      toggleEditMode();
      expect(editMode.value).toBe(false);
    });

    it('should debounce rapid toggles', () => {
      const playerId = ref<string | undefined>('player-1');
      const { editMode, toggleEditMode } = useCalendar({ playerId });

      expect(editMode.value).toBe(false);
      toggleEditMode();
      expect(editMode.value).toBe(true);

      // Immediate second toggle should be ignored (debounce)
      toggleEditMode();
      expect(editMode.value).toBe(true); // Still true because of debounce
    });
  });

  describe('View Mode', () => {
    it('should start in month view', () => {
      const playerId = ref<string | undefined>('player-1');
      const { viewMode } = useCalendar({ playerId });

      expect(viewMode.value).toBe('month');
    });

    it('should switch between month and week views', () => {
      const playerId = ref<string | undefined>('player-1');
      const { viewMode } = useCalendar({ playerId });

      viewMode.value = 'week';
      expect(viewMode.value).toBe('week');

      viewMode.value = 'month';
      expect(viewMode.value).toBe('month');
    });
  });

  describe('goToPrev and goToNext', () => {
    it('should call goToPrevMonth when in month view', () => {
      const playerId = ref<string | undefined>('player-1');
      const { viewMode, currentMonth, currentYear, goToPrev } = useCalendar({ playerId });

      viewMode.value = 'month';
      currentMonth.value = 5;
      currentYear.value = 2026;
      goToPrev();

      expect(currentMonth.value).toBe(4);
    });

    it('should call goToNextMonth when in month view', () => {
      const playerId = ref<string | undefined>('player-1');
      const { viewMode, currentMonth, currentYear, goToNext } = useCalendar({ playerId });

      viewMode.value = 'month';
      currentMonth.value = 5;
      currentYear.value = 2026;
      goToNext();

      expect(currentMonth.value).toBe(6);
    });
  });

  describe('Week Navigation', () => {
    it('should navigate to previous week', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentWeekStart, goToPrevWeek } = useCalendar({ playerId });

      // Set to a known date (Monday, January 20, 2026)
      currentWeekStart.value = new Date(2026, 0, 20);
      goToPrevWeek();

      expect(currentWeekStart.value.getDate()).toBe(13);
      expect(currentWeekStart.value.getMonth()).toBe(0);
    });

    it('should navigate to next week', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentWeekStart, goToNextWeek } = useCalendar({ playerId });

      // Set to a known date (Monday, January 20, 2026)
      currentWeekStart.value = new Date(2026, 0, 20);
      goToNextWeek();

      expect(currentWeekStart.value.getDate()).toBe(27);
      expect(currentWeekStart.value.getMonth()).toBe(0);
    });

    it('should update month when week crosses month boundary', () => {
      const playerId = ref<string | undefined>('player-1');
      const { currentWeekStart, currentMonth, goToNextWeek } = useCalendar({ playerId });

      // Set to last week of January 2026 (Monday, January 26)
      currentWeekStart.value = new Date(2026, 0, 26);
      currentMonth.value = 1;
      goToNextWeek();

      // Week of Feb 2 - mid-week (Feb 5) is in February
      expect(currentMonth.value).toBe(2);
    });

    it('should call goToPrevWeek when in week view', () => {
      const playerId = ref<string | undefined>('player-1');
      const { viewMode, currentWeekStart, goToPrev } = useCalendar({ playerId });

      viewMode.value = 'week';
      currentWeekStart.value = new Date(2026, 0, 20);
      goToPrev();

      expect(currentWeekStart.value.getDate()).toBe(13);
    });

    it('should call goToNextWeek when in week view', () => {
      const playerId = ref<string | undefined>('player-1');
      const { viewMode, currentWeekStart, goToNext } = useCalendar({ playerId });

      viewMode.value = 'week';
      currentWeekStart.value = new Date(2026, 0, 20);
      goToNext();

      expect(currentWeekStart.value.getDate()).toBe(27);
    });
  });

  describe('setAvailability', () => {
    it('should perform optimistic update', async () => {
      const playerId = ref<string | undefined>('player-1');
      const { days, setAvailability } = useCalendar({ playerId });

      // Setup initial data
      days.value = {
        '2026-01-20': {
          date: '2026-01-20',
          currentPlayerStatus: null,
          playerAvailabilities: [{ playerId: 'player-1', playerName: 'Test', status: null }],
          events: [],
        },
      };

      // Don't await - check optimistic update
      const promise = setAvailability('2026-01-20', 'AVAILABLE');

      // Should be updated immediately (optimistic)
      expect(days.value['2026-01-20'].currentPlayerStatus).toBe('AVAILABLE');

      await promise;
    });

    it('should revert on API error', async () => {
      const playerId = ref<string | undefined>('player-1');
      const { days, setAvailability } = useCalendar({ playerId });

      // Mock API to reject
      const { setAvailability: setAvailabilityApi } = await import('@/api/calendar.api');
      vi.mocked(setAvailabilityApi).mockRejectedValueOnce(new Error('API Error'));

      // Setup initial data
      days.value = {
        '2026-01-20': {
          date: '2026-01-20',
          currentPlayerStatus: 'AVAILABLE',
          playerAvailabilities: [{ playerId: 'player-1', playerName: 'Test', status: 'AVAILABLE' }],
          events: [],
        },
      };

      await setAvailability('2026-01-20', 'UNAVAILABLE');

      // Should be reverted to original status
      expect(days.value['2026-01-20'].currentPlayerStatus).toBe('AVAILABLE');
    });

    it('should update playerAvailabilities for current user', async () => {
      const playerId = ref<string | undefined>('player-1');
      const { days, setAvailability } = useCalendar({ playerId });

      days.value = {
        '2026-01-20': {
          date: '2026-01-20',
          currentPlayerStatus: null,
          playerAvailabilities: [
            { playerId: 'player-1', playerName: 'Test', status: null },
            { playerId: 'player-2', playerName: 'Other', status: 'AVAILABLE' },
          ],
          events: [],
        },
      };

      await setAvailability('2026-01-20', 'UNAVAILABLE');

      // Current user's status should be updated
      const player1Avail = days.value['2026-01-20'].playerAvailabilities.find(p => p.playerId === 'player-1');
      expect(player1Avail?.status).toBe('UNAVAILABLE');

      // Other user's status should remain unchanged
      const player2Avail = days.value['2026-01-20'].playerAvailabilities.find(p => p.playerId === 'player-2');
      expect(player2Avail?.status).toBe('AVAILABLE');
    });
  });
});
