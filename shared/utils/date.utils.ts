// Calendar-day utilities, on YYYY-MM-DD strings as the calendar stores them

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
