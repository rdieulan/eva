// Calendar types for availability and events

export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE';

export type EventType = 'MATCH' | 'EVENT';

// Assignment in a game plan (player -> assignment on a map)
export interface MapAssignment {
  visibleplayerId: string;
  visibleplayerName: string;
  assignmentId: number;
  assignmentName: string;
  assignmentColor: string;
}

// Game plan for a map
export interface MapGamePlan {
  mapId: string;
  mapName: string;
  assignments: MapAssignment[];
}

// Complete game plan for a match
export interface MatchGamePlan {
  absentPlayerId: string;
  absentPlayerName: string;
  maps: MapGamePlan[];
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

