// Tests for the scrim display and selection helpers
import { describe, it, expect } from 'vitest';
import type { ScrimOfferedSlot, VenueSlot } from '@shared/types';
import {
  coveredStretches,
  formatMatchCount,
  formatSlotCount,
  formatSlotsDuration,
  keepWholeMatches,
  searchOverlap,
  searchVenueIds,
} from '@/utils/scrims';

function slot(slotId: string, startTime: string, endTime: string, arenaNumber = 1): VenueSlot {
  return { slotId, startTime, endTime, convocationTime: startTime, arenaNumber, gameId: 1, takenSeats: 0, totalSeats: 10, isCompetitiveAvailable: true };
}

describe('scrim formatting', () => {
  it('writes the time slots add up to', () => {
    expect(formatSlotsDuration(1)).toBe('40 min');
    expect(formatSlotsDuration(2)).toBe('1h20');
    expect(formatSlotsDuration(3)).toBe('2h');
    expect(formatSlotsDuration(4)).toBe('2h40');
  });

  it('writes a match length with its time, and a number of matches', () => {
    expect(formatSlotCount(1)).toBe('1 créneau (40 min)');
    expect(formatSlotCount(2)).toBe('2 créneaux (1h20)');
    expect(formatMatchCount(1)).toBe('1 match');
    expect(formatMatchCount(3)).toBe('3 matchs');
  });
});

describe('scrim selection', () => {
  it('keeps the slots that still make whole matches, in evening order', () => {
    const picked = [slot('d', '21:20', '22:00'), slot('a', '18:00', '18:40'), slot('b', '18:40', '19:20'), slot('c', '20:00', '20:40')];
    expect(keepWholeMatches(picked, 2).map(item => item.slotId)).toEqual(['a', 'b']);
    expect(keepWholeMatches(picked, 1).map(item => item.slotId)).toEqual(['a', 'b', 'c', 'd']);
    expect(keepWholeMatches(picked, 3)).toEqual([]);
  });
});

describe('searchVenueIds', () => {
  it('names the venues of a search once each, in the order of its slots', () => {
    const offered = (slotId: string, venueId: string) => ({ slotId, venueId, arenaNumber: 1, startTime: '20:00', endTime: '20:40', convocationTime: '19:50' });
    expect(searchVenueIds({ slots: [offered('a', 'nimes'), offered('b', 'nimes'), offered('c', 'montpellier')] })).toEqual(['nimes', 'montpellier']);
    expect(searchVenueIds({ slots: [] })).toEqual([]);
  });
});

// A slot another team offers, in a venue
function offered(slotId: string, venueId: string, startTime: string, endTime: string, arenaNumber = 1): ScrimOfferedSlot {
  return { slotId, venueId, arenaNumber, startTime, endTime, convocationTime: startTime };
}

describe('coveredStretches', () => {
  it('merges the slots that touch or overlap, arenas together, in the order of the day', () => {
    const slots = [
      offered('c', 'v', '21:20', '22:00'),
      offered('a', 'v', '19:20', '20:00'),
      offered('b', 'v', '20:00', '20:40', 2),
      offered('d', 'v', '20:00', '20:40'),
      offered('e', 'v', '14:00', '14:40'),
    ];
    expect(coveredStretches(slots)).toEqual([
      { startTime: '14:00', endTime: '14:40' },
      { startTime: '19:20', endTime: '20:40' },
      { startTime: '21:20', endTime: '22:00' },
    ]);
  });

  it('runs past midnight for a slot that ends on the next day', () => {
    expect(coveredStretches([offered('a', 'v', '23:20', '00:00'), offered('b', 'v', '22:40', '23:20')])).toEqual([
      { startTime: '22:40', endTime: '00:00' },
    ]);
  });
});

describe('searchOverlap', () => {
  // Les Rivaux offer 19:20 to 22:00 in Nîmes, 40-minute matches, and 20:00 to 21:20 in Montpellier
  const RIVALS = {
    slotCount: 1,
    takenSlotIds: [] as string[],
    slots: [
      offered('n-1920', 'nimes', '19:20', '20:00'),
      offered('n-2000', 'nimes', '20:00', '20:40'),
      offered('n-2040', 'nimes', '20:40', '21:20'),
      offered('n-2120', 'nimes', '21:20', '22:00'),
      offered('m-2000', 'montpellier', '20:00', '20:40'),
      offered('m-2040', 'montpellier', '20:40', '21:20'),
    ],
  };
  const picked = (venueId: string, startTime: string, endTime: string) => ({ venueId, startTime, endTime });

  it('names the venue where the picked hours meet theirs, with all they offer there', () => {
    expect(searchOverlap(RIVALS, [picked('nimes', '20:40', '21:20')])).toEqual([
      { venueId: 'nimes', stretches: [{ startTime: '19:20', endTime: '22:00' }] },
    ]);
  });

  it('names every venue where they meet, in the order of the search', () => {
    expect(searchOverlap(RIVALS, [picked('montpellier', '20:00', '20:40'), picked('nimes', '19:20', '20:00')]).map(meeting => meeting.venueId))
      .toEqual(['nimes', 'montpellier']);
  });

  it('finds nothing at other hours, nor at the same hours in another venue', () => {
    expect(searchOverlap(RIVALS, [picked('nimes', '22:00', '22:40')])).toEqual([]);
    expect(searchOverlap(RIVALS, [picked('agen', '20:00', '20:40')])).toEqual([]);
    expect(searchOverlap(RIVALS, [])).toEqual([]);
  });

  it('leaves out what a match already took, and what is too short for a match of theirs', () => {
    // A match of two slots set at 20:00: before it, one slot only is left, too short
    const search = { ...RIVALS, slotCount: 2, takenSlotIds: ['n-2000', 'n-2040', 'm-2000', 'm-2040'] };
    expect(searchOverlap(search, [picked('nimes', '19:20', '20:00')])).toEqual([]);
    expect(searchOverlap(search, [picked('nimes', '20:00', '20:40')])).toEqual([]);

    const longer = { ...search, slots: [...search.slots, offered('n-2200', 'nimes', '22:00', '22:40')] };
    expect(searchOverlap(longer, [picked('nimes', '21:20', '22:00')])).toEqual([
      { venueId: 'nimes', stretches: [{ startTime: '21:20', endTime: '22:40' }] },
    ]);
  });
});
