// A day of the calendar to lead to, as an address of the app: the same for a
// route inside it and for a link outside it (a chat message)

import type { CalendarTarget } from '@shared/types/calendar.types';

/**
 * The query the calendar reads a target from: the day, the mode, the venue to
 * tick, what to open, and whether to open the reader's availability
 */
export function calendarTargetQuery(target: CalendarTarget): Record<string, string> {
  const query: Record<string, string> = { date: target.date, mode: target.mode };
  if (target.venueId) query.venue = target.venueId;
  if (target.open) query[target.open.kind === 'scrimSearch' ? 'search' : 'event'] = target.open.id;
  if (target.dispos) query.dispos = '1';
  return query;
}

/** A target as a path of the app, for a link from outside it */
export function calendarTargetPath(target: CalendarTarget): string {
  return `/calendar?${new URLSearchParams(calendarTargetQuery(target)).toString()}`;
}
