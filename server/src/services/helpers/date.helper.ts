// Date helper functions
//
// Everything here works in UTC. Prisma `@db.Date` columns are stored as
// UTC-aligned calendar dates, so range bounds and date strings must also be
// UTC — otherwise events on the last day of the month get clipped in any
// positive timezone (e.g. UTC+2 turns May 31 00:00 local into May 30 22:00
// UTC).

/**
 * Format a Date as YYYY-MM-DD using UTC components, so the produced string
 * matches what Postgres stored regardless of the server's local timezone.
 */
export function formatDateStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM string into UTC-aligned month bounds plus convenience
 * `year` / `monthNum` fields.
 *
 * - startDate = first day of month at 00:00 UTC
 * - endDate   = last day of month at 00:00 UTC (inclusive when used with `lte`)
 */
export function parseMonthRange(month: string): {
  startDate: Date;
  endDate: Date;
  year: number;
  monthNum: number;
} {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
  // Day 0 of the next month is the last day of the current one.
  const endDate = new Date(Date.UTC(year, monthNum, 0));
  return { startDate, endDate, year, monthNum };
}
