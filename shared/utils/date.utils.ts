// Calendar-day utilities, on YYYY-MM-DD strings as the calendar stores them,
// and the moment it is in Paris, where our players and venues are

// Short French weekday names, Sunday first as Date.getUTCDay() counts them
const SHORT_WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/**
 * A day in a few characters, e.g. "mer. 25/11": enough to place it in the
 * coming weeks. Read from the date parts alone, so it never shifts with a
 * timezone or a locale.
 */
export function formatShortDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = SHORT_WEEKDAYS[new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()]!;
  return `${weekday} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/** A day moved by a number of days, earlier when negative; both YYYY-MM-DD */
export function shiftDay(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/**
 * A moment as it reads in Paris: its day (YYYY-MM-DD) and its time (HH:mm),
 * whatever the timezone of the machine that reads it
 */
export function toParisTime(instant: Date): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(candidate => candidate.type === type)!.value;
  return { day: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}
