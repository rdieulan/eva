// Date helper functions

/**
 * Format date as YYYY-MM-DD without UTC conversion
 */
export function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse month string to date range
 */
export function parseMonthRange(month: string): {
  startDate: Date;
  endDate: Date;
  year: number;
  monthNum: number;
} {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0); // Last day of month
  return { startDate, endDate, year, monthNum };
}
