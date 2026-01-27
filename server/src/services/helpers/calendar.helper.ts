// Calendar helper functions

import type { EventType, CalendarEvent, MatchGamePlan } from '@shared/types';
import { formatDateStr } from './date.helper';

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
    createdById: event.createdById,
    createdAt: event.createdAt.toISOString(),
  };
}
