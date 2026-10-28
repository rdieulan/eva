// Calendar helper functions

import type { EventType, CalendarEvent, EventVenue, MatchGamePlan } from '@shared/types';
import { formatDateStr } from './date.helper';

// Relation to load alongside an event so it can be formatted for the frontend
export const EVENT_VENUE_INCLUDE = {
  venue: { select: { id: true, name: true, city: true } },
} as const;

/**
 * Format event for frontend consumption
 */
export function formatEventForFrontend(event: {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  type: EventType;
  title: string;
  description: string | null;
  gamePlan: unknown;
  venue?: EventVenue | null;
  arenaNumber?: number | null;
  createdById: string;
  createdAt: Date;
}): CalendarEvent {
  return {
    id: event.id,
    date: formatDateStr(event.date),
    startTime: event.startTime,
    endTime: event.endTime,
    type: event.type,
    title: event.title,
    description: event.description || undefined,
    gamePlan: (event.gamePlan || undefined) as MatchGamePlan | undefined,
    venue: event.venue ?? undefined,
    arenaNumber: event.arenaNumber ?? undefined,
    createdById: event.createdById,
    createdAt: event.createdAt.toISOString(),
  };
}
