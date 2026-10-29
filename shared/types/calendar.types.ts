// Calendar types for availability and events

import type { MatchGamePlan } from './map.types';
import type { SubscriptionRenewal } from './subscription.types';

/**
 * Availability statuses, from most to least available to play. This order is
 * the click cycle in the calendar (then back to "not set") and the order of the
 * player badges. Mirrors the AvailabilityStatus enum in prisma/schema.prisma.
 */
export const AVAILABILITY_STATUSES = ['AVAILABLE', 'CONDITIONAL', 'VOICE_ONLY', 'UNAVAILABLE'] as const;

export type AvailabilityStatus = typeof AVAILABILITY_STATUSES[number];

/**
 * Calendar event types — single source of truth for validation and the
 * creation form. Mirrors the EventType enum in prisma/schema.prisma.
 */
export const EVENT_TYPES = ['MATCH', 'EVENT', 'VOICE_MEETING'] as const;

export type EventType = typeof EVENT_TYPES[number];

/**
 * Platforms a voice meeting can be held on, most used first. Mirrors the
 * VoiceMedium enum in prisma/schema.prisma. OTHER covers the rest: the title
 * or the description of the event says which one.
 */
export const VOICE_MEDIUMS = [
  'DISCORD',
  'TEAMSPEAK',
  'MUMBLE',
  'WHATSAPP',
  'MESSENGER',
  'TELEGRAM',
  'GOOGLE_MEET',
  'OTHER',
] as const;

export type VoiceMedium = typeof VOICE_MEDIUMS[number];


// Availability record for a player on a specific date
export interface Availability {
  id: string;
  playerId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  status: AvailabilityStatus;
}

// Venue of a match, as shown with the event
export interface EventVenue {
  id: string;
  name: string;
  city: string;
}

// Calendar event (match or event)
export interface CalendarEvent {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: string; // Format "HH:mm"
  endTime: string; // Format "HH:mm"
  type: EventType;
  title: string;
  description?: string;
  gamePlan?: MatchGamePlan; // Plan de jeu pour les MATCH
  venue?: EventVenue; // Salle pour les MATCH
  arenaNumber?: number; // Arène de cette salle, quand elle est connue
  voiceMedium?: VoiceMedium; // Plateforme pour les VOICE_MEETING
  createdById: string;
  createdAt: string;
}

// Player availability summary for display
export interface PlayerAvailability {
  playerId: string;
  playerName: string;
  status: AvailabilityStatus | null; // null = non-renseigné
}

// Data for a single day in the calendar
export interface DayData {
  date: string; // ISO date string (YYYY-MM-DD)
  currentPlayerStatus: AvailabilityStatus | null;
  playerAvailabilities: PlayerAvailability[];
  events: CalendarEvent[];
  renewals: SubscriptionRenewal[]; // Team players whose subscription renews that day
}

// Monthly calendar data response
export interface MonthData {
  month: string; // Format "YYYY-MM"
  days: Record<string, DayData>; // Key = date string (YYYY-MM-DD)
  noTeam?: boolean; // True if user has no team
}

// Request to set availability
export interface SetAvailabilityRequest {
  date: string; // ISO date string (YYYY-MM-DD)
  status: AvailabilityStatus | null; // null = supprimer
}

// Request to create an event
export interface CreateEventRequest {
  date: string; // ISO date string (YYYY-MM-DD)
  startTime: string; // Format "HH:mm"
  endTime: string; // Format "HH:mm"
  type: EventType;
  title: string;
  description?: string;
  // Venue of a MATCH. Omitted on creation means the team's own venue; null means none.
  venueId?: string | null;
  // Arena of that venue, between 1 and its arenaCount; null means not decided.
  arenaNumber?: number | null;
  // Platform of a VOICE_MEETING. Required on creation, kept as is when left out on update.
  voiceMedium?: VoiceMedium | null;
}

