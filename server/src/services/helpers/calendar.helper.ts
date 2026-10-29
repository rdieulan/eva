// Calendar helper functions

import type { EventType, CalendarEvent, EventVenue, MatchGamePlan, VoiceMedium } from '@shared/types';
import { ERROR } from '@shared/constants';
import { formatDateStr } from './date.helper';
import { isValidVoiceMedium } from './validation.helper';

// Relation to load alongside an event so it can be formatted for the frontend
export const EVENT_VENUE_INCLUDE = {
  venue: { select: { id: true, name: true, city: true } },
} as const;

// Which platform a voice meeting is held on, or the error to answer with.
// An empty result keeps the one the event already has.
export type VoiceMediumResolution = { voiceMedium?: VoiceMedium | null } | { error: string };

/**
 * The platform of an event being created: only a voice meeting has one, and it
 * has to say which, since a meeting nobody can join is of no use.
 */
export function resolveMediumForCreate(input: {
  type: EventType;
  voiceMedium?: VoiceMedium | null;
}): VoiceMediumResolution {
  if (input.type !== 'VOICE_MEETING') {
    if (input.voiceMedium) return { error: ERROR.voiceMeetingOnlyMedium };
    return { voiceMedium: null };
  }

  if (input.voiceMedium === undefined || input.voiceMedium === null) {
    return { error: ERROR.voiceMediumRequired };
  }
  if (!isValidVoiceMedium(input.voiceMedium)) return { error: ERROR.voiceMediumInvalid };

  return { voiceMedium: input.voiceMedium };
}

/**
 * The platform of an event being updated, given the type it ends up with.
 * Leaving it out keeps the current one, so an event turning into a voice
 * meeting still has to name the platform it moves to.
 */
export function resolveMediumForUpdate(input: {
  type: EventType;
  voiceMedium?: VoiceMedium | null;
  currentMedium: VoiceMedium | null;
}): VoiceMediumResolution {
  if (input.type !== 'VOICE_MEETING') {
    if (input.voiceMedium) return { error: ERROR.voiceMeetingOnlyMedium };
    return { voiceMedium: null };
  }

  if (input.voiceMedium === undefined) {
    return input.currentMedium === null ? { error: ERROR.voiceMediumRequired } : {};
  }
  if (input.voiceMedium === null) return { error: ERROR.voiceMediumRequired };
  if (!isValidVoiceMedium(input.voiceMedium)) return { error: ERROR.voiceMediumInvalid };

  return { voiceMedium: input.voiceMedium };
}

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
  voiceMedium?: VoiceMedium | null;
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
    voiceMedium: event.voiceMedium ?? undefined,
    createdById: event.createdById,
    createdAt: event.createdAt.toISOString(),
  };
}
