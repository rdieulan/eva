// Tests for the days a calendar lays out: a month by week, and a week
import { describe, it, expect, vi, afterEach } from 'vitest';
import { monthDays, weekDays } from '@/utils/calendar';

afterEach(() => {
  vi.useRealTimers();
});

describe('monthDays', () => {
  it('lays a month out in six weeks from Monday, the days around it only filling them', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 11, 12)); // 11 November 2026

    const days = monthDays(2026, 11); // November 2026 starts on a Sunday

    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ date: '2026-10-26', dayNumber: 26, isCurrentMonth: false, isPast: true });
    expect(days[6]).toMatchObject({ date: '2026-11-01', dayNumber: 1, isCurrentMonth: true });
    expect(days[16]).toMatchObject({ date: '2026-11-11', isToday: true, isPast: false });
    expect(days[35]).toMatchObject({ date: '2026-11-30', isCurrentMonth: true });
    expect(days[41]).toMatchObject({ date: '2026-12-06', isCurrentMonth: false, isPast: false });
    expect(days.filter(day => day.isCurrentMonth)).toHaveLength(30);
  });

  it('starts a month beginning on a Monday with its first day, and crosses the years', () => {
    expect(monthDays(2026, 6)[0]).toMatchObject({ date: '2026-06-01', isCurrentMonth: true }); // A Monday
    const january = monthDays(2027, 1); // Starts on a Friday
    expect(january[0]).toMatchObject({ date: '2026-12-28', isCurrentMonth: false });
    expect(january[4]).toMatchObject({ date: '2027-01-01', isCurrentMonth: true });
  });
});

describe('weekDays', () => {
  it('gives the seven days from a Monday, those of another month told apart', () => {
    const days = weekDays(new Date(2026, 10, 30), 11);

    expect(days.map(day => day.date)).toEqual([
      '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06',
    ]);
    expect(days.map(day => day.isCurrentMonth)).toEqual([true, false, false, false, false, false, false]);
  });
});
