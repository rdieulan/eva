// Calendar types for availability and events

import type { GamePhase, PhaseNotes } from './map.types';

export type AvailabilityStatus = 'AVAILABLE' | 'CONDITIONAL' | 'UNAVAILABLE';

export type EventType = 'MATCH' | 'EVENT';

// Assignment in a game plan (player -> assignment on a map)
export interface MapAssignment {
  visiblePlayerId: string;
  visiblePlayerName: string;
  assignmentId: number;
  assignmentName: string;
  assignmentColor: string;
  isMainRole?: boolean; // True if this is the player's main role
}

// Game plan for a map (with phase support)
export interface MapGamePlan {
  mapId: string;
  mapName: string;
  planName?: string; // Name of the selected game plan
  assignments: MapAssignment[];
  phaseNotes?: PhaseNotes; // Notes per phase for this map
}

// Complete game plan for a match (with phase support)
export interface MatchGamePlan {
  absentPlayerId: string;
  absentPlayerName: string;
  maps: MapGamePlan[];
  generalNotes?: string; // General notes for the entire plan
  selectedPhase?: GamePhase; // Last selected phase (for UI state)
}

// Availability record for a user on a specific date
export interface Availability {
  id: string;
  userId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  status: AvailabilityStatus;
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
  createdById: string;
  createdAt: string;
}

// Player availability summary for display
export interface PlayerAvailability {
  userId: string;
  userName: string;
  status: AvailabilityStatus | null; // null = non-renseigné
}

// Data for a single day in the calendar
export interface DayData {
  date: string; // ISO date string (YYYY-MM-DD)
  currentUserStatus: AvailabilityStatus | null;
  playerAvailabilities: PlayerAvailability[];
  events: CalendarEvent[];
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
}

