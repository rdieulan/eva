// Availability of a team as a whole, from the availabilities of its players

import { EVA_SLOT_DURATION_MINUTES, SCRIM_MATCH_SLOTS_MIN, TEAM_PLAYER_COUNT } from '@shared/constants/eva.constants';
import type { AvailabilityHours, AvailabilityStatus } from '@shared/types/calendar.types';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// The shortest stretch a lineup can do something with: the shortest match
const TEAM_WINDOW_MIN_MINUTES = SCRIM_MATCH_SLOTS_MIN * EVA_SLOT_DURATION_MINUTES;

// An HH:mm time of the day, 00:00 to 23:59
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * What can the team do on a day, for sure, from the answers given so far?
 * - ready: play, with a full lineup of players available the whole day
 * - shaky: play, but only on part of the day: the lineup counts players available at given hours
 * - voice: no lineup in the arena yet, but a full table on voice chat
 * - short: nothing, even if every player who has not answered said yes
 * - unknown: nothing yet, and the players who have not answered could still change that
 */
export type TeamAvailabilityStatus = 'ready' | 'shaky' | 'voice' | 'short' | 'unknown';

export interface TeamAvailability {
  status: TeamAvailabilityStatus;
  available: number; // Players available the whole day
  partial: number;   // Players available on part of the day
  voice: number;     // Players on voice chat only
  pending: number;   // Players who have not answered yet
  window: AvailabilityHours | null; // Shaky: the hours a full lineup can play together, the longest stretch
}

// Minutes since midnight of an HH:mm time
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * MINUTES_PER_HOUR + minutes!;
}

function toTime(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR).toString().padStart(2, '0');
  return `${hours}:${(minutes % MINUTES_PER_HOUR).toString().padStart(2, '0')}`;
}

// The stretch of the day hours cover, a bound left out being the start or the end of the day
function span(hours: AvailabilityHours | null | undefined): [number, number] {
  return [
    hours?.startTime ? toMinutes(hours.startTime) : 0,
    hours?.endTime ? toMinutes(hours.endTime) : MINUTES_PER_DAY,
  ];
}

/**
 * The hours a full lineup can play together, the players available the whole
 * day joined by those available at given hours: the longest stretch, the
 * earliest of equals, long enough for a match. Null when there is none.
 */
function commonWindow(allDay: number, partials: [number, number][]): AvailabilityHours | null {
  const bounds = [...new Set([0, MINUTES_PER_DAY, ...partials.flat()])].sort((a, b) => a - b);
  let best: [number, number] | null = null;
  let current: [number, number] | null = null;
  for (let index = 0; index < bounds.length - 1; index++) {
    const [from, to] = [bounds[index]!, bounds[index + 1]!];
    const lineup = allDay + partials.filter(([start, end]) => start <= from && to <= end).length;
    if (lineup >= TEAM_PLAYER_COUNT) {
      current = current ? [current[0], to] : [from, to];
      continue;
    }
    best = longest(best, current);
    current = null;
  }
  best = longest(best, current);
  if (!best) return null;
  const [start, end] = best;
  return { startTime: start === 0 ? null : toTime(start), endTime: end === MINUTES_PER_DAY ? null : toTime(end) };
}

// The longer of two stretches, a candidate too short for a match left out; the first of equals
function longest(best: [number, number] | null, candidate: [number, number] | null): [number, number] | null {
  if (!candidate || candidate[1] - candidate[0] < TEAM_WINDOW_MIN_MINUTES) return best;
  return !best || candidate[1] - candidate[0] > best[1] - best[0] ? candidate : best;
}

/**
 * Assess what a team can do from its players' answers for a day. The verdict
 * is the floor the answers already guarantee: a day with four answers says
 * something, even if the silent players could still lift it. A player
 * available on part of the day counts where their hours meet the others':
 * the day is shaky when a full lineup meets for a match at least, and says
 * when. Players in the arena can also join voice chat, so a voice table counts
 * them too, whatever their hours. An unavailable player is out of everything.
 * A player who has not answered is neither in nor out: silence is not a no, so
 * a day with nothing guaranteed stays open as long as the silent players could
 * still fill a table.
 */
export function assessTeamAvailability(
  players: Array<{ status: AvailabilityStatus | null; hours?: AvailabilityHours | null }>,
): TeamAvailability {
  let available = 0;
  let voice = 0;
  let pending = 0;
  const partials: [number, number][] = [];
  for (const { status, hours } of players) {
    if (status === null) pending++;
    else if (status === 'AVAILABLE') available++;
    else if (status === 'PARTIAL') partials.push(span(hours));
    else if (status === 'VOICE_ONLY') voice++;
  }
  const partial = partials.length;

  const window = available >= TEAM_PLAYER_COUNT ? null : commonWindow(available, partials);
  let status: TeamAvailabilityStatus;
  if (available >= TEAM_PLAYER_COUNT) status = 'ready';
  else if (window) status = 'shaky';
  else if (available + partial + voice >= TEAM_PLAYER_COUNT) status = 'voice';
  else if (available + partial + voice + pending >= TEAM_PLAYER_COUNT) status = 'unknown';
  else status = 'short';

  return { status, available, partial, voice, pending, window };
}

/**
 * Whether the hours a full lineup meets cover a stretch of the day, HH:mm to
 * HH:mm, a bound left out being the start or the end of the day
 */
export function windowCovers(window: AvailabilityHours, span: { startTime: string; endTime: string }): boolean {
  return span.startTime >= (window.startTime ?? '00:00') && span.endTime <= (window.endTime ?? '24:00');
}

/**
 * Whether hours are those of a partial availability: each bound an HH:mm time
 * or left out, one at least given, the end after the start when both are.
 */
export function isValidAvailabilityHours(value: unknown): value is AvailabilityHours {
  if (!value || typeof value !== 'object') return false;
  const { startTime, endTime } = value as Record<string, unknown>;
  const bound = (time: unknown) => time === null || (typeof time === 'string' && TIME_OF_DAY.test(time));
  if (!bound(startTime) || !bound(endTime) || (startTime === null && endTime === null)) return false;
  return startTime === null || endTime === null || (startTime as string) < (endTime as string);
}

/**
 * Hours in a few characters, for a line of the calendar: "20:00 – 23:00",
 * "dès 21:00", "jusqu'à 22:00"
 */
export function formatAvailabilityHours(hours: AvailabilityHours): string {
  if (hours.startTime && hours.endTime) return `${hours.startTime} – ${hours.endTime}`;
  if (hours.startTime) return `dès ${hours.startTime}`;
  return `jusqu'à ${hours.endTime}`;
}

/**
 * Hours in a sentence: "de 20:00 à 23:00", "à partir de 21:00", "jusqu'à 22:00"
 */
export function describeAvailabilityHours(hours: AvailabilityHours): string {
  if (hours.startTime && hours.endTime) return `de ${hours.startTime} à ${hours.endTime}`;
  if (hours.startTime) return `à partir de ${hours.startTime}`;
  return `jusqu'à ${hours.endTime}`;
}
