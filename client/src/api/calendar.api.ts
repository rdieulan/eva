// Calendar API client

import type {
  MonthData,
  Availability,
  CalendarEvent,
  SetAvailabilityRequest,
  CreateEventRequest,
  AvailabilityStatus,
} from '@shared/types';

/**
 * Get auth headers
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Fetch calendar data for a month
 * @param month Format YYYY-MM
 */
export async function fetchMonthData(month: string): Promise<MonthData> {
  const response = await fetch(`/api/calendar/availability?month=${month}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors du chargement du calendrier');
  }

  return response.json();
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

  const response = await fetch('/api/calendar/availability', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors de la mise à jour de la disponibilité');
  }

  return response.json();
}

/**
 * Fetch events for a month
 * @param month Format YYYY-MM
 */
export async function fetchEvents(month: string): Promise<CalendarEvent[]> {
  const response = await fetch(`/api/calendar/events?month=${month}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors du chargement des événements');
  }

  return response.json();
}

/**
 * Create a new event (Admin only)
 */
export async function createEvent(event: CreateEventRequest): Promise<CalendarEvent> {
  const response = await fetch('/api/calendar/events', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de la création de l'événement");
  }

  return response.json();
}

/**
 * Update an event (Admin only)
 */
export async function updateEvent(
  id: string,
  event: Partial<CreateEventRequest>
): Promise<CalendarEvent> {
  const response = await fetch(`/api/calendar/events/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de la modification de l'événement");
  }

  return response.json();
}

/**
 * Delete an event (Admin only)
 */
export async function deleteEvent(id: string): Promise<void> {
  const response = await fetch(`/api/calendar/events/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de la suppression de l'événement");
  }
}

