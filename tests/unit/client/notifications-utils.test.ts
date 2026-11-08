// Tests for notifications in the app: how long ago one came
import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '@/utils/notifications';

describe('formatRelativeTime', () => {
  const now = new Date(2026, 10, 25, 20, 0).getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MINUTE = 60 * 1000;

  it('says minutes, hours, then days, and the day itself past a week', () => {
    expect(formatRelativeTime(ago(20 * 1000), now)).toBe('à l\'instant');
    expect(formatRelativeTime(ago(5 * MINUTE), now)).toBe('il y a 5 min');
    expect(formatRelativeTime(ago(3 * 60 * MINUTE), now)).toBe('il y a 3 h');
    expect(formatRelativeTime(ago(30 * 60 * MINUTE), now)).toBe('hier');
    expect(formatRelativeTime(ago(3 * 24 * 60 * MINUTE), now)).toBe('il y a 3 jours');
    expect(formatRelativeTime(new Date(2026, 10, 12, 18, 0).toISOString(), now)).toBe('le jeu. 12/11');
  });
});
