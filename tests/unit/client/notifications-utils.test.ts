// Tests for notifications in the app: where one leads, and how long ago it came
import { describe, it, expect } from 'vitest';
import { formatRelativeTime, notificationRoute } from '@/utils/notifications';

describe('notificationRoute', () => {
  it('turns a target into a calendar route: the day, the mode, the venue to tick, what to open', () => {
    expect(notificationRoute({ page: 'calendar', date: '2026-11-25', mode: 'team' }))
      .toEqual({ path: '/calendar', query: { date: '2026-11-25', mode: 'team' } });
    expect(notificationRoute({ page: 'calendar', date: '2026-11-25', mode: 'team', open: { kind: 'event', id: 'event-1' } }))
      .toEqual({ path: '/calendar', query: { date: '2026-11-25', mode: 'team', event: 'event-1' } });
    expect(notificationRoute({
      page: 'calendar', date: '2026-11-25', mode: 'matchmaking', venueId: 'venue-nimes', open: { kind: 'scrimSearch', id: 'search-1' },
    })).toEqual({ path: '/calendar', query: { date: '2026-11-25', mode: 'matchmaking', venue: 'venue-nimes', search: 'search-1' } });
  });
});

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
