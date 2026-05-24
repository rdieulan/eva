// Tests for date helper functions
//
// All assertions are UTC-based: formatDateStr now reads UTC components so the
// produced strings line up with what Postgres stored for @db.Date columns.

import { describe, it, expect } from 'vitest';
import { formatDateStr, parseMonthRange } from '@services/helpers/date.helper';

describe('formatDateStr', () => {
  it('should format a simple date correctly', () => {
    const date = new Date(Date.UTC(2026, 0, 15)); // January 15, 2026
    expect(formatDateStr(date)).toBe('2026-01-15');
  });

  it('should pad single digit months and days', () => {
    const date = new Date(Date.UTC(2026, 4, 5)); // May 5, 2026
    expect(formatDateStr(date)).toBe('2026-05-05');
  });

  it('should handle end of year', () => {
    const date = new Date(Date.UTC(2026, 11, 31)); // December 31, 2026
    expect(formatDateStr(date)).toBe('2026-12-31');
  });

  it('should handle first day of year', () => {
    const date = new Date(Date.UTC(2026, 0, 1)); // January 1, 2026
    expect(formatDateStr(date)).toBe('2026-01-01');
  });

  it('should return the same calendar date regardless of host timezone', () => {
    // A date stored as 2026-05-31 in Postgres comes back as 2026-05-31T00:00:00Z.
    // In a UTC-negative timezone, the local day would be the 30th — formatDateStr
    // must still produce "2026-05-31" so day-keyed lookups keep working.
    const dbDate = new Date('2026-05-31T00:00:00.000Z');
    expect(formatDateStr(dbDate)).toBe('2026-05-31');
  });
});

describe('parseMonthRange', () => {
  it('should parse January correctly', () => {
    const result = parseMonthRange('2026-01');
    expect(result.year).toBe(2026);
    expect(result.monthNum).toBe(1);
    expect(result.startDate.getUTCDate()).toBe(1);
    expect(result.endDate.getUTCDate()).toBe(31);
  });

  it('should parse February in a non-leap year', () => {
    const result = parseMonthRange('2026-02');
    expect(result.endDate.getUTCDate()).toBe(28);
  });

  it('should parse February in a leap year', () => {
    const result = parseMonthRange('2024-02');
    expect(result.endDate.getUTCDate()).toBe(29);
  });

  it('should parse December correctly', () => {
    const result = parseMonthRange('2026-12');
    expect(result.year).toBe(2026);
    expect(result.monthNum).toBe(12);
    expect(result.endDate.getUTCDate()).toBe(31);
  });

  it('should handle months with 30 days', () => {
    const result = parseMonthRange('2026-04'); // April
    expect(result.endDate.getUTCDate()).toBe(30);
  });

  it('should produce UTC-aligned bounds so DB date comparisons do not clip the last day', () => {
    // Bug scenario: in UTC+2, naive new Date(2026, 5, 0) is 2026-05-30T22:00:00Z.
    // The fix is that endDate is now 2026-05-31T00:00:00Z, so events on May 31
    // (stored at 2026-05-31T00:00:00Z by Postgres) are inclusively matched.
    const result = parseMonthRange('2026-05');
    expect(result.startDate.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(result.endDate.toISOString()).toBe('2026-05-31T00:00:00.000Z');
  });
});
