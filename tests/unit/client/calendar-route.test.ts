// Tests for a day of the calendar as a route of the app
import { describe, it, expect } from 'vitest';
import { calendarRoute } from '@/utils/calendar';

describe('calendarRoute', () => {
  it('turns a target into a calendar route: the day, the mode, the venue to tick, what to open', () => {
    expect(calendarRoute({ page: 'calendar', date: '2026-11-25', mode: 'team' }))
      .toEqual({ path: '/calendar', query: { date: '2026-11-25', mode: 'team' } });
    expect(calendarRoute({ page: 'calendar', date: '2026-11-25', mode: 'team', open: { kind: 'event', id: 'event-1' } }))
      .toEqual({ path: '/calendar', query: { date: '2026-11-25', mode: 'team', event: 'event-1' } });
    expect(calendarRoute({
      page: 'calendar', date: '2026-11-25', mode: 'matchmaking', venueId: 'venue-nimes', open: { kind: 'scrimSearch', id: 'search-1' },
    })).toEqual({ path: '/calendar', query: { date: '2026-11-25', mode: 'matchmaking', venue: 'venue-nimes', search: 'search-1' } });
  });
});
