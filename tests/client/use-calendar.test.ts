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
      const userId = ref<string | undefined>('user-1');
      const { currentMonth, currentYear, goToNextMonth } = useCalendar({ userId });

      currentMonth.value = 5;
      currentYear.value = 2026;
      goToNextMonth();

      expect(currentMonth.value).toBe(6);
      expect(currentYear.value).toBe(2026);
    });

    it('should navigate to next year when going from December', () => {
      const userId = ref<string | undefined>('user-1');
      const { currentMonth, currentYear, goToNextMonth } = useCalendar({ userId });

      currentMonth.value = 12;
      currentYear.value = 2026;
      goToNextMonth();

      expect(currentMonth.value).toBe(1);
      expect(currentYear.value).toBe(2027);
    });

    it('should navigate to previous month within same year', () => {
      const userId = ref<string | undefined>('user-1');
      const { currentMonth, currentYear, goToPrevMonth } = useCalendar({ userId });

      currentMonth.value = 5;
      currentYear.value = 2026;
      goToPrevMonth();

      expect(currentMonth.value).toBe(4);
      expect(currentYear.value).toBe(2026);
    });

    it('should navigate to previous year when going from January', () => {
      const userId = ref<string | undefined>('user-1');
      const { currentMonth, currentYear, goToPrevMonth } = useCalendar({ userId });

      currentMonth.value = 1;
      currentYear.value = 2026;
      goToPrevMonth();

      expect(currentMonth.value).toBe(12);
      expect(currentYear.value).toBe(2025);
    });
  });

  describe('Computed Properties', () => {
    it('should format monthString correctly', () => {
      const userId = ref<string | undefined>('user-1');
      const { currentMonth, currentYear, monthString } = useCalendar({ userId });

      currentMonth.value = 1;
      currentYear.value = 2026;
      expect(monthString.value).toBe('2026-01');

      currentMonth.value = 12;
      expect(monthString.value).toBe('2026-12');
    });

    it('should format monthDisplay in French', () => {
      const userId = ref<string | undefined>('user-1');
      const { currentMonth, currentYear, monthDisplay } = useCalendar({ userId });

      currentMonth.value = 1;
      currentYear.value = 2026;
      expect(monthDisplay.value).toBe('Janvier 2026');

      currentMonth.value = 7;
      expect(monthDisplay.value).toBe('Juillet 2026');
    });

    it('should return navigationTitle based on viewMode', () => {
      const userId = ref<string | undefined>('user-1');
      const { viewMode, currentMonth, currentYear, navigationTitle, monthDisplay } = useCalendar({ userId });

      currentMonth.value = 3;
      currentYear.value = 2026;
      viewMode.value = 'month';

      expect(navigationTitle.value).toBe(monthDisplay.value);
    });
  });

  describe('Edit Mode', () => {
    it('should toggle edit mode', async () => {
      const userId = ref<string | undefined>('user-1');
      const { editMode, toggleEditMode } = useCalendar({ userId });

      expect(editMode.value).toBe(false);
      toggleEditMode();
      expect(editMode.value).toBe(true);

      // Wait for debounce (50ms)
      await new Promise(resolve => setTimeout(resolve, 60));

      toggleEditMode();
      expect(editMode.value).toBe(false);
    });

    it('should debounce rapid toggles', () => {
      const userId = ref<string | undefined>('user-1');
      const { editMode, toggleEditMode } = useCalendar({ userId });

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
      const userId = ref<string | undefined>('user-1');
      const { viewMode } = useCalendar({ userId });

      expect(viewMode.value).toBe('month');
    });

    it('should switch between month and week views', () => {
      const userId = ref<string | undefined>('user-1');
      const { viewMode } = useCalendar({ userId });

      viewMode.value = 'week';
      expect(viewMode.value).toBe('week');

      viewMode.value = 'month';
      expect(viewMode.value).toBe('month');
    });
  });

  describe('goToPrev and goToNext', () => {
    it('should call goToPrevMonth when in month view', () => {
      const userId = ref<string | undefined>('user-1');
      const { viewMode, currentMonth, currentYear, goToPrev } = useCalendar({ userId });

      viewMode.value = 'month';
      currentMonth.value = 5;
      currentYear.value = 2026;
      goToPrev();

      expect(currentMonth.value).toBe(4);
    });

    it('should call goToNextMonth when in month view', () => {
      const userId = ref<string | undefined>('user-1');
      const { viewMode, currentMonth, currentYear, goToNext } = useCalendar({ userId });

      viewMode.value = 'month';
      currentMonth.value = 5;
      currentYear.value = 2026;
      goToNext();

      expect(currentMonth.value).toBe(6);
    });
  });
});
