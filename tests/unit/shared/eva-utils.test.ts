// Tests for the links we build into eva.gg's own web app
import { describe, it, expect } from 'vitest';
import { buildEvaBookingUrl, assessSlotHeadcount } from '@shared/utils';
import { MATCH_PLAYER_COUNT } from '@shared/constants';

describe('assessSlotHeadcount', () => {
  it('counts against a full match, never against the capacity eva.gg shows', () => {
    expect(assessSlotHeadcount(MATCH_PLAYER_COUNT)).toEqual({ status: 'full', label: '8/8 joueurs', note: null });
  });

  it('says how many players are missing', () => {
    expect(assessSlotHeadcount(7)).toEqual({ status: 'missing', label: '7/8 joueurs', note: 'il en manque 1' });
    expect(assessSlotHeadcount(0)).toEqual({ status: 'missing', label: '0/8 joueurs', note: 'il en manque 8' });
  });

  it('says how many players are in excess, to sort out with the venue', () => {
    expect(assessSlotHeadcount(9)).toEqual({ status: 'over', label: '9/8 joueurs', note: '1 de trop' });
    expect(assessSlotHeadcount(10)).toEqual({ status: 'over', label: '10/8 joueurs', note: '2 de trop' });
  });
});

describe('buildEvaBookingUrl', () => {
  it('opens the booking calendar of the venue on the day of the match', () => {
    const url = new URL(buildEvaBookingUrl(51, '2026-11-03')!);

    expect(url.origin + url.pathname).toBe('https://app.eva.gg/fr-FR/booking/calendar');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      locationId: '51',
      seatCount: '1',
      gameIds: '1',
      currentDate: '2026-11-03',
    });
  });

  it('has nowhere to send a player for a venue eva.gg does not run', () => {
    expect(buildEvaBookingUrl(null, '2026-11-03')).toBeNull();
  });
});
