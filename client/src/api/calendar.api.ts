// Calendar API client

import type {
  MonthData,
  Availability,
  CalendarEvent,
  SetAvailabilityRequest,
  CreateEventRequest,
  AvailabilityStatus,
  MatchGamePlan,
} from '@shared/types';
import { ERROR } from '@shared/constants';
import { authFetch } from '@/api/utils';

/**
 * Fetch calendar data for a month
 * @param month Format YYYY-MM
 */
export async function fetchMonthData(month: string): Promise<MonthData> {
  return authFetch<MonthData>(
    `/api/calendar/availability?month=${month}`,
    undefined,
    ERROR.calendarLoadFailed
  );
}

/**
 * Set availability for a specific date
 * @param date Format YYYY-MM-DD
 * @param status AVAILABLE, UNAVAILABLE, or null to remove
 */
export async function setAvailability(
  date: string,
  status: AvailabilityStatus | null
): Promise<Availability | { success: true; deleted: true }> {
  const body: SetAvailabilityRequest = { date, status };
  return authFetch<Availability | { success: true; deleted: true }>(
    '/api/calendar/availability',
    { method: 'POST', body: JSON.stringify(body) },
    ERROR.availabilityUpdateFailed
  );
}

/**
 * Fetch events for a month
 * @param month Format YYYY-MM
 */
export async function fetchEvents(month: string): Promise<CalendarEvent[]> {
  return authFetch<CalendarEvent[]>(
    `/api/calendar/events?month=${month}`,
    undefined,
    ERROR.eventsLoadFailed
  );
}

/**
 * Create a new event (Admin only)
 */
export async function createEvent(eventData: CreateEventRequest): Promise<CalendarEvent> {
  return authFetch<CalendarEvent>(
    '/api/calendar/events',
    { method: 'POST', body: JSON.stringify(eventData) },
    ERROR.eventCreationFailed
  );
}

/**
 * Update an event (Admin only)
 */
export async function updateEvent(
  id: string,
  eventData: Partial<CreateEventRequest>
): Promise<CalendarEvent> {
  return authFetch<CalendarEvent>(
    `/api/calendar/events/${id}`,
    { method: 'PUT', body: JSON.stringify(eventData) },
    ERROR.eventUpdateFailed
  );
}

/**
 * Delete an event (Admin only)
 */
export async function deleteEvent(id: string): Promise<void> {
  return authFetch<void>(
    `/api/calendar/events/${id}`,
    { method: 'DELETE' },
    ERROR.eventDeleteFailed
  );
}

/**
 * Update the game plan for a match event (Admin only)
 */
export async function updateEventGamePlan(
  eventId: string,
  gamePlan: MatchGamePlan | null
): Promise<CalendarEvent> {
  return authFetch<CalendarEvent>(
    `/api/calendar/events/${eventId}/gameplan`,
    { method: 'PUT', body: JSON.stringify({ gamePlan }) },
    ERROR.eventGamePlanUpdateFailed
  );
}
