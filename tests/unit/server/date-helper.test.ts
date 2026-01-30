// Tests for date helper functions

import { describe, it, expect } from 'vitest';
import { formatDateStr, parseMonthRange } from '@services/helpers/date.helper';

describe('formatDateStr', () => {
  it('should format a simple date correctly', () => {
    const date = new Date(2026, 0, 15); // January 15, 2026
    expect(formatDateStr(date)).toBe('2026-01-15');
  });

  it('should pad single digit months and days', () => {
    const date = new Date(2026, 4, 5); // May 5, 2026
    expect(formatDateStr(date)).toBe('2026-05-05');
  });

  it('should handle end of year', () => {
    const date = new Date(2026, 11, 31); // December 31, 2026
    expect(formatDateStr(date)).toBe('2026-12-31');
  });

  it('should handle first day of year', () => {
    const date = new Date(2026, 0, 1); // January 1, 2026
    expect(formatDateStr(date)).toBe('2026-01-01');
  });
});

describe('parseMonthRange', () => {
  it('should parse January correctly', () => {
    const result = parseMonthRange('2026-01');
    expect(result.year).toBe(2026);
    expect(result.monthNum).toBe(1);
    expect(result.startDate.getDate()).toBe(1);
    expect(result.endDate.getDate()).toBe(31);
  });

  it('should parse February in a non-leap year', () => {
    const result = parseMonthRange('2026-02');
    expect(result.endDate.getDate()).toBe(28);
  });

  it('should parse February in a leap year', () => {
    const result = parseMonthRange('2024-02');
    expect(result.endDate.getDate()).toBe(29);
  });

  it('should parse December correctly', () => {
    const result = parseMonthRange('2026-12');
    expect(result.year).toBe(2026);
    expect(result.monthNum).toBe(12);
    expect(result.endDate.getDate()).toBe(31);
  });

  it('should handle months with 30 days', () => {
    const result = parseMonthRange('2026-04'); // April
    expect(result.endDate.getDate()).toBe(30);
  });
});
