// Calendar types for availability and events

import type { MatchGamePlan } from './map.types';
import type { SubscriptionRenewal } from './subscription.types';
import type { VenueEventView } from './venue.types';

/**
 * Availability statuses, from most to least available to play: the order the
 * players of a day are listed in. PARTIAL is available to play on part of the
 * day only, its hours given with it (AvailabilityHours). Mirrors the
 * AvailabilityStatus enum in prisma/schema.prisma.
 */
export const AVAILABILITY_STATUSES = ['AVAILABLE', 'PARTIAL', 'VOICE_ONLY', 'UNAVAILABLE'] as const;

export type AvailabilityStatus = typeof AVAILABILITY_STATUSES[number];

/**
 * The hours of a partial availability: from when, until when, or both. A
 * bound left out is the start or the end of the day.
 */
export interface AvailabilityHours {
  startTime: string | null; // HH:mm
  endTime: string | null;   // HH:mm
}

/**
 * Calendar event types — single source of truth for validation and the
 * creation form, in the order the form offers them. Mirrors the EventType
 * enum in prisma/schema.prisma. A competition is a tournament the team plays,
 * a month of its local league for one.
 */
export const EVENT_TYPES = ['MATCH', 'COMPETITION', 'EVENT', 'VOICE_MEETING'] as const;

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
  hours: AvailabilityHours | null; // PARTIAL only
}

// Venue of a match, as shown with the event
export interface EventVenue {
  id: string;
  name: string;
  evaLocationId: number | null; // Id of the venue on eva.gg, to link into their booking calendar
  discord: string | null; // The venue's Discord, where the team finds the staff and the other teams
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
  evaSlotIds: string[]; // Créneaux de cette salle sur lesquels le match se joue, consécutifs, dans l'ordre ; vide si aucun
  voiceMedium?: VoiceMedium; // Plateforme pour les VOICE_MEETING
  scrimSearchId?: string; // Match fait par le matchmaking : la recherche dont il vient. Son heure et son lieu ne changent pas, il s'annule des deux côtés
  createdById: string;
  createdAt: string;
}

// Player availability summary for display
export interface PlayerAvailability {
  playerId: string;
  playerName: string;
  status: AvailabilityStatus | null; // null = non-renseigné
  hours: AvailabilityHours | null; // Horaires d'une dispo partielle (PARTIAL) ; null sinon
}

// Data for a single day in the calendar
export interface DayData {
  date: string; // ISO date string (YYYY-MM-DD)
  currentPlayerStatus: AvailabilityStatus | null;
  currentPlayerHours: AvailabilityHours | null; // Horaires du joueur connecté quand il est dispo en partie
  playerAvailabilities: PlayerAvailability[];
  events: CalendarEvent[];
  renewals: SubscriptionRenewal[]; // Team players whose subscription renews that day
  venueEvents: VenueEventView[];   // The events of the team's venue, open to all, the team has not added
}

// Monthly calendar data response
/**
 * A day of the calendar to lead to, whatever leads there (a notification, the
 * public board of a venue) and whatever the medium: the app turns it into a
 * route, a mail or a chat message would turn it into a link
 */
export interface CalendarTarget {
  page: 'calendar';
  date: string;                   // YYYY-MM-DD, the day to show
  mode: 'team' | 'matchmaking';
  venueId?: string;               // In matchmaking, a venue to tick: where the search is
  open?: { kind: 'scrimSearch' | 'event'; id: string }; // What to open on that day, when it is still there
  dispos?: boolean;               // In team mode, the reader's availability, ready to give it
}

export interface MonthData {
  month: string; // Format "YYYY-MM"
  days: Record<string, DayData>; // Key = date string (YYYY-MM-DD)
  noTeam?: boolean; // True if user has no team
}

// Request to set availability
export interface SetAvailabilityRequest {
  date: string; // ISO date string (YYYY-MM-DD)
  status: AvailabilityStatus | null; // null = supprimer
  hours?: AvailabilityHours | null; // Requis pour PARTIAL, absent pour les autres statuts
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
  // Slots of that venue the match runs on, consecutive and in order; null or empty means none
  // picked. On update, left out keeps them unless the venue, date or start time move, since
  // the slots are tied to them.
  evaSlotIds?: string[] | null;
  // Platform of a VOICE_MEETING. Required on creation, kept as is when left out on update.
  voiceMedium?: VoiceMedium | null;
}

