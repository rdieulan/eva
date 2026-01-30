// Tests for validation helper functions

import { describe, it, expect } from 'vitest';
import {
  isValidMonth,
  isValidDate,
  isValidTime,
  isValidEventType,
  isValidAvailabilityStatus,
} from '@services/helpers/validation.helper';

describe('isValidMonth', () => {
  it('should accept valid month format', () => {
    expect(isValidMonth('2026-01')).toBe(true);
    expect(isValidMonth('2026-12')).toBe(true);
    expect(isValidMonth('1999-06')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidMonth('2026-1')).toBe(false);
    expect(isValidMonth('26-01')).toBe(false);
    expect(isValidMonth('2026/01')).toBe(false);
    expect(isValidMonth('2026-01-01')).toBe(false);
    expect(isValidMonth('janvier')).toBe(false);
  });

  it('should reject non-string types', () => {
    expect(isValidMonth(202601)).toBe(false);
    expect(isValidMonth(null)).toBe(false);
    expect(isValidMonth(undefined)).toBe(false);
    expect(isValidMonth({ month: '2026-01' })).toBe(false);
  });
});

describe('isValidDate', () => {
  it('should accept valid date format', () => {
    expect(isValidDate('2026-01-15')).toBe(true);
    expect(isValidDate('2026-12-31')).toBe(true);
    expect(isValidDate('1999-06-01')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidDate('2026-01')).toBe(false);
    expect(isValidDate('2026-1-15')).toBe(false);
    expect(isValidDate('26-01-15')).toBe(false);
    expect(isValidDate('2026/01/15')).toBe(false);
    expect(isValidDate('15-01-2026')).toBe(false);
  });

  it('should reject non-string types', () => {
    expect(isValidDate(20260115)).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe('isValidTime', () => {
  it('should accept valid time format', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('12:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('09:05')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidTime('9:05')).toBe(false);
    expect(isValidTime('12:5')).toBe(false);
    expect(isValidTime('12-30')).toBe(false);
    expect(isValidTime('12:30:00')).toBe(false);
    expect(isValidTime('midi')).toBe(false);
  });

  it('should reject non-string types', () => {
    expect(isValidTime(1230)).toBe(false);
    expect(isValidTime(null)).toBe(false);
    expect(isValidTime(undefined)).toBe(false);
  });
});

describe('isValidEventType', () => {
  it('should accept valid event types', () => {
    expect(isValidEventType('MATCH')).toBe(true);
    expect(isValidEventType('EVENT')).toBe(true);
  });

  it('should reject invalid values', () => {
    expect(isValidEventType('match')).toBe(false);
    expect(isValidEventType('Match')).toBe(false);
    expect(isValidEventType('GAME')).toBe(false);
    expect(isValidEventType('')).toBe(false);
    expect(isValidEventType(null)).toBe(false);
    expect(isValidEventType(undefined)).toBe(false);
  });
});

describe('isValidAvailabilityStatus', () => {
  it('should accept valid availability statuses', () => {
    expect(isValidAvailabilityStatus('AVAILABLE')).toBe(true);
    expect(isValidAvailabilityStatus('CONDITIONAL')).toBe(true);
    expect(isValidAvailabilityStatus('UNAVAILABLE')).toBe(true);
    expect(isValidAvailabilityStatus(null)).toBe(true);
  });

  it('should reject invalid values', () => {
    expect(isValidAvailabilityStatus('available')).toBe(false);
    expect(isValidAvailabilityStatus('MAYBE')).toBe(false);
    expect(isValidAvailabilityStatus('')).toBe(false);
    expect(isValidAvailabilityStatus(undefined)).toBe(false);
  });
});
