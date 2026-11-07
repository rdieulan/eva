// Tests for the runs of venue slots a match takes, and the matches an offer holds
import { describe, it, expect } from 'vitest';
import {
  countMatches,
  followsOn,
  isOneRun,
  orderRunSlots,
  runSpan,
  slotStreaks,
  spansOverlap,
  type RunSlot,
} from '@shared/utils';

function slot(startTime: string, endTime: string, arenaNumber = 1, venueId?: string): RunSlot & { id: string } {
  return { id: `${venueId ?? ''}a${arenaNumber}-${startTime}`, startTime, endTime, arenaNumber, ...(venueId ? { venueId } : {}) };
}

// Arena 1: three in a row, a gap, one more; arena 2: two in a row
const EVENING = [
  slot('18:00', '18:40'),
  slot('18:40', '19:20'),
  slot('19:20', '20:00'),
  slot('20:40', '21:20'),
  slot('18:00', '18:40', 2),
  slot('18:40', '19:20', 2),
];

describe('followsOn and isOneRun', () => {
  it('needs the same arena of the same venue and the next start at the previous end', () => {
    expect(followsOn(slot('18:00', '18:40'), slot('18:40', '19:20'))).toBe(true);
    expect(followsOn(slot('18:00', '18:40'), slot('19:20', '20:00'))).toBe(false);
    expect(followsOn(slot('18:00', '18:40'), slot('18:40', '19:20', 2))).toBe(false);
    expect(followsOn(slot('18:00', '18:40', 1, 'nimes'), slot('18:40', '19:20', 1, 'nimes'))).toBe(true);
    expect(followsOn(slot('18:00', '18:40', 1, 'nimes'), slot('18:40', '19:20', 1, 'montpellier'))).toBe(false);
  });

  it('says whether slots in time order make one run', () => {
    expect(isOneRun(EVENING.slice(0, 3))).toBe(true);
    expect(isOneRun(EVENING.slice(2, 4))).toBe(false);
    expect(isOneRun([])).toBe(true);
  });
});

describe('orderRunSlots', () => {
  it('orders slots venue by venue, arena by arena, then by time', () => {
    const ordered = orderRunSlots([
      slot('19:20', '20:00', 2, 'nimes'),
      slot('20:00', '20:40', 1, 'nimes'),
      slot('18:00', '18:40', 1, 'montpellier'),
      slot('18:00', '18:40', 1, 'nimes'),
    ]);
    expect(ordered.map(item => item.id)).toEqual(['montpelliera1-18:00', 'nimesa1-18:00', 'nimesa1-20:00', 'nimesa2-19:20']);
  });

  it('orders the slots of a single venue arena by arena, then by time', () => {
    const ordered = orderRunSlots([slot('19:20', '20:00', 2), slot('20:00', '20:40'), slot('18:00', '18:40')]);
    expect(ordered.map(item => item.id)).toEqual(['a1-18:00', 'a1-20:00', 'a2-19:20']);
  });
});

describe('slotStreaks', () => {
  it('cuts the evening at each gap and each new arena', () => {
    expect(slotStreaks(EVENING).map(streak => streak.map(item => item.id))).toEqual([
      ['a1-18:00', 'a1-18:40', 'a1-19:20'],
      ['a1-20:40'],
      ['a2-18:00', 'a2-18:40'],
    ]);
  });

  it('leaves out the slots it is told to, each one breaking its streak', () => {
    const streaks = slotStreaks(EVENING, item => item.id !== 'a1-18:40');
    expect(streaks.map(streak => streak.map(item => item.id))).toEqual([
      ['a1-18:00'],
      ['a1-19:20'],
      ['a1-20:40'],
      ['a2-18:00', 'a2-18:40'],
    ]);
  });

  it('never runs a streak from one venue into another', () => {
    const streaks = slotStreaks([slot('18:00', '18:40', 1, 'montpellier'), slot('18:40', '19:20', 1, 'nimes')]);
    expect(streaks).toHaveLength(2);
  });
});

describe('runSpan and spansOverlap', () => {
  it('reads a run as minutes from midnight, a run ending at or past midnight ending the next day', () => {
    expect(runSpan({ startTime: '20:00', endTime: '21:20' })).toEqual({ start: 1200, end: 1280 });
    expect(runSpan({ startTime: '23:20', endTime: '00:00' })).toEqual({ start: 1400, end: 1440 });
    expect(runSpan({ startTime: '23:20', endTime: '00:40' })).toEqual({ start: 1400, end: 1480 });
  });

  it('tells overlapping stretches, one ending when the other starts not counting', () => {
    const eight = runSpan({ startTime: '20:00', endTime: '21:20' });
    expect(spansOverlap(eight, runSpan({ startTime: '20:40', endTime: '22:00' }))).toBe(true);
    expect(spansOverlap(eight, runSpan({ startTime: '19:20', endTime: '20:40' }))).toBe(true);
    expect(spansOverlap(eight, runSpan({ startTime: '21:20', endTime: '22:40' }))).toBe(false);
    expect(spansOverlap(eight, runSpan({ startTime: '18:40', endTime: '20:00' }))).toBe(false);
  });
});

describe('countMatches', () => {
  it('counts the matches the slots hold, one at a time', () => {
    // Arena 2 runs at the time of arena 1: one match of one slot at 18:00, then 18:40, 19:20, 20:40
    expect(countMatches(EVENING, 1)).toBe(4);
    // Three in a row hold one match of two; the arena 2 pair is at the same time
    expect(countMatches(EVENING, 2)).toBe(1);
    expect(countMatches(EVENING, 3)).toBe(1);
    expect(countMatches(EVENING, 4)).toBe(0);
    expect(countMatches([], 2)).toBe(0);
  });

  it('counts matches back to back, one starting when the other ends', () => {
    const fourInARow = [slot('20:00', '20:40'), slot('20:40', '21:20'), slot('21:20', '22:00'), slot('22:00', '22:40')];
    expect(countMatches(fourInARow, 2)).toBe(2);
  });

  it('never counts two matches at the same time, on two arenas or in two venues', () => {
    const twoArenas = orderRunSlots([slot('20:00', '20:40'), slot('20:40', '21:20'), slot('20:00', '20:40', 2), slot('20:40', '21:20', 2)]);
    expect(countMatches(twoArenas, 2)).toBe(1);

    const twoVenues = orderRunSlots([
      slot('20:00', '20:40', 1, 'nimes'), slot('20:40', '21:20', 1, 'nimes'),
      slot('20:40', '21:20', 1, 'montpellier'), slot('21:20', '22:00', 1, 'montpellier'),
    ]);
    expect(countMatches(twoVenues, 2)).toBe(1);
  });

  it('counts matches across venues, one after the other', () => {
    const evening = orderRunSlots([
      slot('20:00', '20:40', 1, 'nimes'), slot('20:40', '21:20', 1, 'nimes'),
      slot('21:20', '22:00', 1, 'montpellier'), slot('22:00', '22:40', 1, 'montpellier'),
    ]);
    expect(countMatches(evening, 2)).toBe(2);
  });

  it('picks the runs that leave room for the most matches', () => {
    // Taking 18:40 to 20:00 first would leave a single slot on each side
    const evening = [slot('18:00', '18:40'), slot('18:40', '19:20'), slot('19:20', '20:00'), slot('20:00', '20:40')];
    expect(countMatches(evening, 2)).toBe(2);
  });

  it('leaves out the runs at the time of the matches already made', () => {
    const fourInARow = [slot('20:00', '20:40'), slot('20:40', '21:20'), slot('21:20', '22:00'), slot('22:00', '22:40')];
    expect(countMatches(fourInARow, 2, [runSpan({ startTime: '20:00', endTime: '21:20' })])).toBe(1);
    // A match in the middle leaves a single slot on each side
    expect(countMatches(fourInARow, 2, [runSpan({ startTime: '20:40', endTime: '22:00' })])).toBe(0);
    // A match elsewhere at the same time takes that time too
    expect(countMatches(fourInARow, 2, [runSpan({ startTime: '20:00', endTime: '22:40' })])).toBe(0);
  });
});
