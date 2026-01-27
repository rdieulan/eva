// Calendar service - business logic for availability and events

import { prisma } from '@db/prisma';
import type {
  DayData,
  PlayerAvailability,
  AvailabilityStatus,
  EventType,
} from '@shared/types';
import { formatDateStr, parseMonthRange } from './helpers/date.helper';
import { formatEventForFrontend } from './helpers/calendar.helper';

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
  currentUserId: string
): Promise<{ month: string; days: Record<string, DayData> }> {
  const { startDate, endDate, year, monthNum } = parseMonthRange(month);

  // Fetch all availabilities for the month (filtered by team via user)
  const availabilities = await prisma.availability.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      user: { teamId },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  // Fetch all users of the same team for the player list
  const users = await prisma.user.findMany({
    where: { teamId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Fetch all events for the month (filtered by team)
  const events = await prisma.calendarEvent.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      teamId,
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  // Build response: group by date
  const days: Record<string, DayData> = {};

  // Initialize all days of the month
  for (let day = 1; day <= endDate.getDate(); day++) {
    const date = new Date(year, monthNum - 1, day);
    const dateStr = formatDateStr(date);

    const playerAvailabilities: PlayerAvailability[] = users.map(user => ({
      userId: user.id,
      userName: user.name,
      status: null,
    }));

    days[dateStr] = {
      date: dateStr,
      currentUserStatus: null,
      playerAvailabilities,
      events: [],
    };
  }

  // Fill in availabilities
  for (const availability of availabilities) {
    const dateStr = formatDateStr(availability.date);
    const dayData = days[dateStr];

    if (dayData) {
      const playerAvail = dayData.playerAvailabilities.find(
        p => p.userId === availability.userId
      );
      if (playerAvail) {
        playerAvail.status = availability.status;
      }
      if (availability.userId === currentUserId) {
        dayData.currentUserStatus = availability.status;
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

  for (let day = 1; day <= endDate.getDate(); day++) {
    const date = new Date(year, monthNum - 1, day);
    const dateStr = formatDateStr(date);
    days[dateStr] = {
      date: dateStr,
      currentUserStatus: null,
      playerAvailabilities: [],
      events: [],
    };
  }

  return { month, days, noTeam: true };
}

/**
 * Set or remove availability for a user
 */
export async function setAvailability(
  userId: string,
  date: string,
  status: AvailabilityStatus | null
): Promise<{ success: boolean; deleted?: boolean; availability?: unknown }> {
  const dateObj = new Date(date);

  if (status === null) {
    await prisma.availability.deleteMany({
      where: { userId, date: dateObj },
    });
    return { success: true, deleted: true };
  }

  const availability = await prisma.availability.upsert({
    where: {
      userId_date: { userId, date: dateObj },
    },
    create: { userId, date: dateObj, status },
    update: { status },
  });

  return {
    success: true,
    availability: {
      id: availability.id,
      userId: availability.userId,
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
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  return events.map(formatEventForFrontend);
}

export interface CreateEventData {
  date: string;
  startTime: string;
  endTime: string;
  type: EventType;
  title: string;
  description?: string;
  teamId: string;
  createdById: string;
}

/**
 * Create a new event
 */
export async function createEvent(data: CreateEventData) {
  const event = await prisma.calendarEvent.create({
    data: {
      date: new Date(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      createdById: data.createdById,
      teamId: data.teamId,
    },
  });

  return formatEventForFrontend(event);
}

/**
 * Get event by ID with team verification
 */
export async function getEventWithTeamCheck(eventId: string, teamId?: string): Promise<
  | { notFound: true }
  | { accessDenied: true }
  | { event: { id: string; type: string; teamId: string | null } }
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
    },
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
  });

  return formatEventForFrontend(event);
}
