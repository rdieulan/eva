// Runs of venue slots: a match takes consecutive slots on one arena of one
// venue, and a team plays one match at a time

// A slot as these helpers read it
export interface RunSlot {
  venueId?: string;  // Where the slot is, when slots of several venues are read together
  arenaNumber: number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

/**
 * Whether `next` starts when `previous` ends, on the same arena of the same venue
 */
export function followsOn(previous: RunSlot, next: RunSlot): boolean {
  return next.venueId === previous.venueId
    && next.arenaNumber === previous.arenaNumber
    && next.startTime === previous.endTime;
}

/**
 * Whether slots, ordered by time, make one run on one arena
 */
export function isOneRun(ordered: RunSlot[]): boolean {
  return ordered.every((slot, index) => index === 0 || followsOn(ordered[index - 1]!, slot));
}

/**
 * Slots in the order these helpers read them: venue by venue, arena by arena,
 * then by time. Slots of a single venue need no venue.
 */
export function orderRunSlots<T extends RunSlot>(slots: T[]): T[] {
  return [...slots].sort((a, b) =>
    (a.venueId ?? '').localeCompare(b.venueId ?? '')
    || a.arenaNumber - b.arenaNumber
    || a.startTime.localeCompare(b.startTime));
}

/**
 * The slots cut into streaks: the longest runs of consecutive slots on one
 * arena. A slot `keep` refuses is left out and breaks the streak it sits in.
 * Expects the slots ordered as orderRunSlots does.
 */
export function slotStreaks<T extends RunSlot>(ordered: T[], keep: (slot: T) => boolean = () => true): T[][] {
  const streaks: T[][] = [];
  let current: T[] = [];
  for (const slot of ordered) {
    const previous = current[current.length - 1];
    if (!keep(slot) || (previous && !followsOn(previous, slot))) {
      if (current.length) streaks.push(current);
      current = [];
    }
    if (keep(slot)) current.push(slot);
  }
  if (current.length) streaks.push(current);
  return streaks;
}

// A stretch of the day, in minutes from midnight
export interface TimeSpan {
  start: number;
  end: number;
}

const MINUTES_PER_DAY = 24 * 60;

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/**
 * The stretch a slot or a run takes, from its start to its end. eva.gg lists
 * a session on the day it starts, so one that ends at or past midnight ends on
 * the next day.
 */
export function runSpan(run: { startTime: string; endTime: string }): TimeSpan {
  const start = minutesOf(run.startTime);
  const end = minutesOf(run.endTime);
  return { start, end: end <= start ? end + MINUTES_PER_DAY : end };
}

/**
 * Whether two stretches overlap; one ending when the other starts does not
 */
export function spansOverlap(a: TimeSpan, b: TimeSpan): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * How many matches of `length` slots the slots hold, for a team that plays
 * one at a time: each match on consecutive slots of one arena, no two at the
 * same time, and none at the same time as `busy`, the matches already made.
 * Expects the slots ordered as orderRunSlots does.
 */
export function countMatches(ordered: RunSlot[], length: number, busy: TimeSpan[] = []): number {
  // Every run of that length the streaks hold, as the stretch it takes
  const runs: TimeSpan[] = [];
  for (const streak of slotStreaks(ordered)) {
    for (let first = 0; first + length <= streak.length; first++) {
      const span = runSpan({ startTime: streak[first]!.startTime, endTime: streak[first + length - 1]!.endTime });
      if (!busy.some(taken => spansOverlap(taken, span))) runs.push(span);
    }
  }

  // The run that ends first leaves the most room for the next: taking runs in
  // that order, each one that starts after the last taken ends, makes the
  // most matches
  runs.sort((a, b) => a.end - b.end);
  let count = 0;
  let freeFrom = -Infinity;
  for (const span of runs) {
    if (span.start >= freeFrom) {
      count++;
      freeFrom = span.end;
    }
  }
  return count;
}
