// Links into eva.gg's own web app

import { COMPETITIVE_GAME_ID, EVA_BOOKING_CALENDAR_URL, MATCH_PLAYER_COUNT } from '@shared/constants/eva.constants';

// Whether a slot holds a full match: short of players, exactly full, or with
// extra people in who are not expected
export type SlotHeadcountStatus = 'missing' | 'full' | 'over';

export interface SlotHeadcount {
  status: SlotHeadcountStatus;
  label: string; // "7/8 joueurs"
  note: string | null; // "il en manque 1", "1 de trop", null when full
}

/**
 * Compare the players booked on a slot with a full match of MATCH_PLAYER_COUNT.
 * Anything but exactly that number deserves a look: a missing player, or an
 * extra one who joined the slot and has to be sorted out with the venue.
 */
export function assessSlotHeadcount(takenSeats: number): SlotHeadcount {
  const label = `${takenSeats}/${MATCH_PLAYER_COUNT} joueurs`;
  const delta = takenSeats - MATCH_PLAYER_COUNT;

  if (delta < 0) {
    const missing = -delta;
    return { status: 'missing', label, note: missing > 1 ? `il en manque ${missing}` : 'il en manque 1' };
  }
  if (delta > 0) {
    return { status: 'over', label, note: delta > 1 ? `${delta} de trop` : '1 de trop' };
  }
  return { status: 'full', label, note: null };
}

/**
 * Where a player books their seat: the booking calendar of a venue, opened on
 * a day (YYYY-MM-DD). One seat, the competitive game, as their own links do.
 * Returns null for a venue eva.gg does not run.
 */
export function buildEvaBookingUrl(evaLocationId: number | null, date: string): string | null {
  if (evaLocationId === null) return null;

  const params = new URLSearchParams({
    locationId: String(evaLocationId),
    seatCount: '1',
    gameIds: String(COMPETITIVE_GAME_ID),
    currentDate: date,
  });
  return `${EVA_BOOKING_CALENDAR_URL}?${params.toString()}`;
}
