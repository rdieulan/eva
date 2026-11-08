// A day of the calendar to lead to, as an address of the app: the same for a
// route inside it and for a link outside it (a chat message, a mail)

import type { CalendarTarget } from '@shared/types/calendar.types';

/**
 * The query the calendar reads a target from: the day, the mode, the venue to
 * tick and what to open
 */
export function calendarTargetQuery(target: CalendarTarget): Record<string, string> {
  const query: Record<string, string> = { date: target.date, mode: target.mode };
  if (target.venueId) query.venue = target.venueId;
  if (target.open) query[target.open.kind === 'scrimSearch' ? 'search' : 'event'] = target.open.id;
  return query;
}

/** A target as a path of the app, for a link from outside it */
export function calendarTargetPath(target: CalendarTarget): string {
  return `/calendar?${new URLSearchParams(calendarTargetQuery(target)).toString()}`;
}
