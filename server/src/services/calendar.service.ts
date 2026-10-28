// Calendar service - business logic for availability and events

import { prisma } from '@db/prisma';
import type {
  DayData,
  PlayerAvailability,
  AvailabilityStatus,
  EventType,
} from '@shared/types';
import { ERROR } from '@shared/constants';
import { isSubscriptionRenewalDay } from '@shared/utils';
import { formatDateStr, parseMonthRange } from './helpers/date.helper';
import { EVENT_VENUE_INCLUDE, formatEventForFrontend } from './helpers/calendar.helper';

// Re-export validation helpers for routes
export {
  isValidMonth,
  isValidDate,
  isValidTime,
  isValidEventType,
  isValidAvailabilityStatus,
} from './helpers/validation.helper';

// ============================================
// Availability operations
// ============================================

/**
 * Get all availabilities for a month (team-filtered)
 */
export async function getMonthAvailability(
  month: string,
  teamId: string,
  currentPlayerId: string
): Promise<{ month: string; days: Record<string, DayData> }> {
  const { startDate, endDate, year, monthNum } = parseMonthRange(month);

  // Fetch all availabilities for the month (filtered by team via player)
  const availabilities = await prisma.availability.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      player: { teamId },
    },
    include: {
      player: {
        include: { user: { select: { id: true, name: true } } }
      },
    },
  });

  // Fetch all players of the same team
  const players = await prisma.player.findMany({
    where: { teamId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  // Fetch all events for the month (filtered by team)
  const events = await prisma.calendarEvent.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      teamId,
    },
    include: EVENT_VENUE_INCLUDE,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  // Subscription renewal anchors of the players who entered one
  const renewalAnchors = players
    .filter(player => player.subscriptionRenewalDate)
    .map(player => ({
      anchorDate: formatDateStr(player.subscriptionRenewalDate!),
      renewal: { playerId: player.id, playerName: player.user!.name, tier: player.subscriptionTier },
    }));

  // Build response: group by date
  const days: Record<string, DayData> = {};

  // Initialize all days of the month
  for (let day = 1; day <= endDate.getUTCDate(); day++) {
    const dateStr = formatDateStr(new Date(Date.UTC(year, monthNum - 1, day)));

    const playerAvailabilities: PlayerAvailability[] = players.map(player => ({
      playerId: player.id,
      playerName: player.user!.name,
      status: null,
    }));

    days[dateStr] = {
      date: dateStr,
      currentPlayerStatus: null,
      playerAvailabilities,
      events: [],
      renewals: renewalAnchors
        .filter(({ anchorDate }) => isSubscriptionRenewalDay(anchorDate, dateStr))
        .map(({ renewal }) => renewal),
    };
  }

  // Fill in availabilities
  for (const availability of availabilities) {
    const dateStr = formatDateStr(availability.date);
    const dayData = days[dateStr];
    const availabilityPlayerId = availability.playerId;

    if (dayData) {
      const playerAvailability = dayData.playerAvailabilities.find(
        p => p.playerId === availabilityPlayerId
      );
      if (playerAvailability) {
        playerAvailability.status = availability.status;
      }
      if (availabilityPlayerId === currentPlayerId) {
        dayData.currentPlayerStatus = availability.status;
      }
    }
  }

  // Fill in events
  for (const event of events) {
    const dateStr = formatDateStr(event.date);
    const dayData = days[dateStr];

    if (dayData) {
      dayData.events.push(formatEventForFrontend(event));
    }
  }

  return { month, days };
}

/**
 * Build empty calendar for users without team
 */
export function buildEmptyCalendar(month: string): { month: string; days: Record<string, DayData>; noTeam: boolean } {
  const { endDate, year, monthNum } = parseMonthRange(month);
  const days: Record<string, DayData> = {};

  for (let day = 1; day <= endDate.getUTCDate(); day++) {
    const dateStr = formatDateStr(new Date(Date.UTC(year, monthNum - 1, day)));
    days[dateStr] = {
      date: dateStr,
      currentPlayerStatus: null,
      playerAvailabilities: [],
      events: [],
      renewals: [],
    };
  }

  return { month, days, noTeam: true };
}

/**
 * Set or remove availability for a player
 */
export async function setAvailability(
  playerId: string,
  date: string,
  status: AvailabilityStatus | null
): Promise<{ success: boolean; deleted?: boolean; availability?: unknown }> {
  const dateObj = new Date(date);


  if (status === null) {
    await prisma.availability.deleteMany({
      where: { playerId, date: dateObj },
    });
    return { success: true, deleted: true };
  }

  const availability = await prisma.availability.upsert({
    where: {
      playerId_date: { playerId, date: dateObj },
    },
    create: { playerId, date: dateObj, status },
    update: { status },
  });

  return {
    success: true,
    availability: {
      id: availability.id,
      playerId: availability.playerId,
      date: formatDateStr(availability.date),
      status: availability.status,
    },
  };
}

// ============================================
// Event operations
// ============================================

/**
 * Get all events for a month
 */
export async function getMonthEvents(month: string, teamId: string) {
  const { startDate, endDate } = parseMonthRange(month);

  const events = await prisma.calendarEvent.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      teamId,
    },
    include: EVENT_VENUE_INCLUDE,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  return events.map(formatEventForFrontend);
}

// Where a match is played: the venue and the arena of that venue, or the error
// to answer with. A field left out keeps its current value.
export type MatchPlace = { venueId?: string | null; arenaNumber?: number | null };
export type MatchPlaceResolution = MatchPlace | { error: string };

/**
 * Check the arena against the venue it is supposed to belong to.
 * Arenas are numbered 1 to arenaCount, and none is valid without a venue.
 */
async function resolveArena(
  venueId: string | null,
  arenaNumber: number | null,
): Promise<{ arenaNumber: number | null } | { error: string }> {
  if (arenaNumber === null) return { arenaNumber: null };
  if (venueId === null) return { error: ERROR.arenaRequiresVenue };

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { arenaCount: true },
  });
  if (!venue) return { error: ERROR.venueNotFound };

  const isKnownArena = Number.isInteger(arenaNumber) && arenaNumber >= 1 && arenaNumber <= venue.arenaCount;
  return isKnownArena ? { arenaNumber } : { error: ERROR.arenaNumberInvalid };
}

async function venueExists(venueId: string): Promise<boolean> {
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
  return venue !== null;
}

/**
 * Where a match being created is played: only a match has a venue, and a match
 * created without an explicit one is played in the venue its team is affiliated
 * with. The arena is only kept when it exists in that venue.
 */
export async function resolvePlaceForCreate(input: {
  type: EventType;
  venueId?: string | null;
  arenaNumber?: number | null;
  teamId: string;
}): Promise<MatchPlaceResolution> {
  if (input.type !== 'MATCH') {
    if (input.venueId) return { error: ERROR.matchOnlyVenue };
    if (input.arenaNumber) return { error: ERROR.arenaRequiresVenue };
    return { venueId: null, arenaNumber: null };
  }

  let venueId: string | null;
  if (input.venueId === undefined) {
    const team = await prisma.team.findUnique({
      where: { id: input.teamId },
      select: { venueId: true },
    });
    venueId = team?.venueId ?? null;
  } else {
    if (input.venueId !== null && !await venueExists(input.venueId)) {
      return { error: ERROR.venueNotFound };
    }
    venueId = input.venueId;
  }

  const arena = await resolveArena(venueId, input.arenaNumber ?? null);
  if ('error' in arena) return arena;

  return { venueId, arenaNumber: arena.arenaNumber };
}

/**
 * Where a match being updated is played, given the type it ends up with.
 * Leaving the venue out keeps the current one; moving the match to another
 * venue drops an arena that was not re-stated, since numbers differ per venue.
 */
export async function resolvePlaceForUpdate(input: {
  type: EventType;
  venueId?: string | null;
  arenaNumber?: number | null;
  currentVenueId: string | null;
}): Promise<MatchPlaceResolution> {
  if (input.type !== 'MATCH') {
    if (input.venueId) return { error: ERROR.matchOnlyVenue };
    if (input.arenaNumber) return { error: ERROR.arenaRequiresVenue };
    return { venueId: null, arenaNumber: null };
  }

  const venueChanges = input.venueId !== undefined && input.venueId !== input.currentVenueId;
  if (input.venueId !== undefined && input.venueId !== null && !await venueExists(input.venueId)) {
    return { error: ERROR.venueNotFound };
  }
  const venueId = input.venueId === undefined ? input.currentVenueId : input.venueId;

  // Nothing to say about the arena, and the venue it belonged to has not moved
  if (input.arenaNumber === undefined && !venueChanges) {
    return input.venueId === undefined ? {} : { venueId };
  }

  const arena = await resolveArena(venueId, input.arenaNumber ?? null);
  if ('error' in arena) return arena;

  return input.venueId === undefined
    ? { arenaNumber: arena.arenaNumber }
    : { venueId, arenaNumber: arena.arenaNumber };
}

export interface CreateEventData {
  date: string;
  startTime: string;
  endTime: string;
  type: EventType;
  title: string;
  description?: string;
  venueId?: string | null;
  arenaNumber?: number | null;
  teamId: string;
  createdByUserId: string;
}

/**
 * Create a new event
 */
export async function createEvent(data: CreateEventData) {
  // Get player ID from user ID
  const user = await prisma.user.findUnique({
    where: { id: data.createdByUserId },
    include: { player: true },
  });

  if (!user?.player) {
    throw new Error('Account not found or has no player profile');
  }

  const event = await prisma.calendarEvent.create({
    data: {
      date: new Date(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      venueId: data.venueId ?? null,
      arenaNumber: data.arenaNumber ?? null,
      createdById: user.player.id,
      teamId: data.teamId,
    },
    include: EVENT_VENUE_INCLUDE,
  });

  return formatEventForFrontend(event);
}

/**
 * Get event by ID with team verification
 */
export async function getEventWithTeamCheck(eventId: string, teamId?: string): Promise<
  | { notFound: true }
  | { accessDenied: true }
  | { event: { id: string; type: EventType; teamId: string | null; venueId: string | null } }
> {
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });

  if (!event) {
    return { notFound: true };
  }

  if (teamId && event.teamId && event.teamId !== teamId) {
    return { accessDenied: true };
  }

  return { event };
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await prisma.calendarEvent.delete({ where: { id: eventId } });
}

export interface UpdateEventData {
  date?: string;
  startTime?: string;
  endTime?: string;
  type?: EventType;
  title?: string;
  description?: string;
  venueId?: string | null;
  arenaNumber?: number | null;
}

/**
 * Update an event
 */
export async function updateEvent(eventId: string, data: UpdateEventData) {
  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      ...(data.date && { date: new Date(data.date) }),
      ...(data.startTime && { startTime: data.startTime }),
      ...(data.endTime && { endTime: data.endTime }),
      ...(data.type && { type: data.type }),
      ...(data.title && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.venueId !== undefined && { venueId: data.venueId }),
      ...(data.arenaNumber !== undefined && { arenaNumber: data.arenaNumber }),
    },
    include: EVENT_VENUE_INCLUDE,
  });

  return formatEventForFrontend(event);
}

/**
 * Update game plan for an event
 */
export async function updateEventGamePlan(eventId: string, gamePlan: unknown) {
  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { gamePlan: gamePlan === null || gamePlan === undefined ? undefined : gamePlan as object },
    include: EVENT_VENUE_INCLUDE,
  });

  return formatEventForFrontend(event);
}
