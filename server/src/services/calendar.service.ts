// Calendar service - business logic for availability and events

import { prisma } from '@db/prisma';
import type {
  DayData,
  PlayerAvailability,
  AvailabilityHours,
  AvailabilityStatus,
  EventType,
  VoiceMedium,
} from '@shared/types';
import { ERROR, EVA_SLOT_ID_MAX_LENGTH, EVA_SLOTS_PER_MATCH_MAX } from '@shared/constants';
import { isSubscriptionRenewalDay } from '@shared/utils';
import { formatDateStr, parseMonthRange } from './helpers/date.helper';
import { EVENT_VENUE_INCLUDE, formatEventForFrontend } from './helpers/calendar.helper';

// Re-export validation helpers for routes
export {
  isValidMonth,
  isValidDate,
  isValidTime,
  isValidTimeRange,
  isValidEventType,
  isValidVoiceMedium,
  isValidAvailabilityStatus,
} from './helpers/validation.helper';

// Resolving the platform of a voice meeting needs no database lookup
export { resolveMediumForCreate, resolveMediumForUpdate } from './helpers/calendar.helper';

// ============================================
// Availability operations
// ============================================

/**
 * Get all availabilities for a month (team-filtered)
 */
// The hours a stored availability gives: a partial one only
function availabilityHours(availability: { status: AvailabilityStatus; startTime: string | null; endTime: string | null }): AvailabilityHours | null {
  return availability.status === 'PARTIAL' ? { startTime: availability.startTime, endTime: availability.endTime } : null;
}

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
      hours: null,
    }));

    days[dateStr] = {
      date: dateStr,
      currentPlayerStatus: null,
      currentPlayerHours: null,
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
        playerAvailability.hours = availabilityHours(availability);
      }
      if (availabilityPlayerId === currentPlayerId) {
        dayData.currentPlayerStatus = availability.status;
        dayData.currentPlayerHours = availabilityHours(availability);
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
      currentPlayerHours: null,
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
  status: AvailabilityStatus | null,
  hours: AvailabilityHours | null = null, // A partial availability's hours, validated by the caller; none for the other statuses
): Promise<{ success: boolean; deleted?: boolean; availability?: unknown }> {
  const dateObj = new Date(date);


  if (status === null) {
    await prisma.availability.deleteMany({
      where: { playerId, date: dateObj },
    });
    return { success: true, deleted: true };
  }

  const times = { startTime: hours?.startTime ?? null, endTime: hours?.endTime ?? null };
  const availability = await prisma.availability.upsert({
    where: {
      playerId_date: { playerId, date: dateObj },
    },
    create: { playerId, date: dateObj, status, ...times },
    update: { status, ...times },
  });

  return {
    success: true,
    availability: {
      id: availability.id,
      playerId: availability.playerId,
      date: formatDateStr(availability.date),
      status: availability.status,
      hours: availabilityHours(availability),
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

// Where a match is played: the venue, the arena of that venue and the eva.gg
// slots it runs on, or the error to answer with. A field left out keeps its
// current value.
export type MatchPlace = { venueId?: string | null; arenaNumber?: number | null; evaSlotIds?: string[] };
export type MatchPlaceResolution = MatchPlace | { error: string };

/**
 * Check the eva.gg slots a match is placed on: opaque ids we only bound and
 * keep distinct, that make no sense without the venue they belong to. Whether
 * they follow each other is only known to eva.gg, so it is the form's job.
 */
function resolveSlots(
  venueId: string | null,
  evaSlotIds: unknown,
): { evaSlotIds: string[] } | { error: string } {
  if (evaSlotIds === null || evaSlotIds === undefined) return { evaSlotIds: [] };
  if (!Array.isArray(evaSlotIds) || evaSlotIds.length > EVA_SLOTS_PER_MATCH_MAX) return { error: ERROR.evaSlotsInvalid };

  const trimmed: string[] = [];
  for (const id of evaSlotIds) {
    if (typeof id !== 'string') return { error: ERROR.evaSlotsInvalid };
    const clean = id.trim();
    if (!clean || clean.length > EVA_SLOT_ID_MAX_LENGTH || trimmed.includes(clean)) return { error: ERROR.evaSlotsInvalid };
    trimmed.push(clean);
  }
  if (trimmed.length && venueId === null) return { error: ERROR.slotRequiresVenue };

  return { evaSlotIds: trimmed };
}

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
  evaSlotIds?: string[] | null;
  teamId: string;
}): Promise<MatchPlaceResolution> {
  if (input.type !== 'MATCH') {
    if (input.venueId) return { error: ERROR.matchOnlyVenue };
    if (input.arenaNumber) return { error: ERROR.arenaRequiresVenue };
    if (input.evaSlotIds?.length) return { error: ERROR.matchOnlySlot };
    return { venueId: null, arenaNumber: null, evaSlotIds: [] };
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

  const slots = resolveSlots(venueId, input.evaSlotIds);
  if ('error' in slots) return slots;

  return { venueId, arenaNumber: arena.arenaNumber, evaSlotIds: slots.evaSlotIds };
}

/**
 * Where a match being updated is played, given the type it ends up with.
 * Leaving the venue out keeps the current one; moving the match to another
 * venue drops an arena that was not re-stated, since numbers differ per venue.
 * The eva.gg slots are tied to the venue, the day and the start time: they are
 * kept only while none of them moves, unless they are re-stated.
 */
export async function resolvePlaceForUpdate(input: {
  type: EventType;
  venueId?: string | null;
  arenaNumber?: number | null;
  evaSlotIds?: string[] | null;
  date?: string;
  startTime?: string;
  current: { venueId: string | null; date: string; startTime: string };
}): Promise<MatchPlaceResolution> {
  if (input.type !== 'MATCH') {
    if (input.venueId) return { error: ERROR.matchOnlyVenue };
    if (input.arenaNumber) return { error: ERROR.arenaRequiresVenue };
    if (input.evaSlotIds?.length) return { error: ERROR.matchOnlySlot };
    return { venueId: null, arenaNumber: null, evaSlotIds: [] };
  }

  const venueChanges = input.venueId !== undefined && input.venueId !== input.current.venueId;
  if (input.venueId !== undefined && input.venueId !== null && !await venueExists(input.venueId)) {
    return { error: ERROR.venueNotFound };
  }
  const venueId = input.venueId === undefined ? input.current.venueId : input.venueId;

  const place: MatchPlace = {};
  if (input.venueId !== undefined) place.venueId = venueId;

  // The arena is re-checked when stated, or dropped when its venue moves
  if (input.arenaNumber !== undefined || venueChanges) {
    const arena = await resolveArena(venueId, input.arenaNumber ?? null);
    if ('error' in arena) return arena;
    place.arenaNumber = arena.arenaNumber;
  }

  const slotAnchorMoves = venueChanges
    || (input.date !== undefined && input.date !== input.current.date)
    || (input.startTime !== undefined && input.startTime !== input.current.startTime);
  if (input.evaSlotIds !== undefined || slotAnchorMoves) {
    const slots = resolveSlots(venueId, input.evaSlotIds);
    if ('error' in slots) return slots;
    place.evaSlotIds = slots.evaSlotIds;
  }

  return place;
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
  evaSlotIds?: string[];
  voiceMedium?: VoiceMedium | null;
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
      evaSlotIds: data.evaSlotIds ?? [],
      voiceMedium: data.voiceMedium ?? null,
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
  | { event: { id: string; type: EventType; teamId: string | null; venueId: string | null;
      voiceMedium: VoiceMedium | null; date: Date; startTime: string; endTime: string;
      arenaNumber: number | null; evaSlotIds: string[]; scrimSearchId: string | null } }
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
 * Whether a change moves a match: another day, other times, another type,
 * venue, arena or slots than it has. A field left out moves nothing.
 */
export function movesMatch(
  current: { date: Date; startTime: string; endTime: string; type: EventType; venueId: string | null; arenaNumber: number | null; evaSlotIds: string[] },
  change: { date?: string; startTime?: string; endTime?: string; type?: EventType; venueId?: string | null; arenaNumber?: number | null; evaSlotIds?: string[] | null },
): boolean {
  if (change.date !== undefined && change.date !== formatDateStr(current.date)) return true;
  if (change.startTime !== undefined && change.startTime !== current.startTime) return true;
  if (change.endTime !== undefined && change.endTime !== current.endTime) return true;
  if (change.type !== undefined && change.type !== current.type) return true;
  if (change.venueId !== undefined && change.venueId !== current.venueId) return true;
  if (change.arenaNumber !== undefined && (change.arenaNumber ?? null) !== current.arenaNumber) return true;
  if (change.evaSlotIds !== undefined && (change.evaSlotIds ?? []).join('|') !== current.evaSlotIds.join('|')) return true;
  return false;
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
  evaSlotIds?: string[];
  voiceMedium?: VoiceMedium | null;
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
      ...(data.evaSlotIds !== undefined && { evaSlotIds: data.evaSlotIds }),
      ...(data.voiceMedium !== undefined && { voiceMedium: data.voiceMedium }),
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
