// Time-of-day utilities, on HH:mm strings as the calendar stores them

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * Shift an HH:mm time by a number of minutes, wrapping around midnight
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = (((hours! * MINUTES_PER_HOUR + mins! + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(total / MINUTES_PER_HOUR).toString().padStart(2, '0');
  const m = (total % MINUTES_PER_HOUR).toString().padStart(2, '0');
  return `${h}:${m}`;
}
