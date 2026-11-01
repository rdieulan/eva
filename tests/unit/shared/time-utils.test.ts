// Tests for time-of-day arithmetic on HH:mm strings
import { describe, it, expect } from 'vitest';
import { addMinutesToTime } from '@shared/utils';

describe('addMinutesToTime', () => {
  it('adds minutes within the hour and across it', () => {
    expect(addMinutesToTime('20:00', 40)).toBe('20:40');
    expect(addMinutesToTime('20:40', 40)).toBe('21:20');
  });

  it('keeps two digits', () => {
    expect(addMinutesToTime('09:05', 5)).toBe('09:10');
  });

  it('wraps around midnight in both directions', () => {
    expect(addMinutesToTime('23:40', 40)).toBe('00:20');
    expect(addMinutesToTime('00:10', -20)).toBe('23:50');
  });
});
