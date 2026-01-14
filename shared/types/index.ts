// Shared types barrel export
// Types only - no functions here

export type { Point, Zone, ZoneRect, ZonePolygon, ZoneMulti } from './zone.types';
export type { Player, PlayerAssignment } from './player.types';
export type {
  GamePhase,
  PhaseZones,
  PhaseNotes,
  GamePlanNotes,
  GamePlan,
  GamePlanSummary,
  Assignment,
  MapConfig,
  AppState,
} from './map.types';
export {
  GAME_PHASES,
  PHASE_LABELS,
  DEFAULT_PHASE_NOTES,
  DEFAULT_GAME_PLAN_NOTES,
  getZoneForPhase,
  isLegacyAssignment,
  migrateAssignmentToPhases,
  migrateMapConfigToPhases,
} from './map.types';
export type {
  AvailabilityStatus,
  EventType,
  Availability,
  CalendarEvent,
  PlayerAvailability,
  DayData,
  MonthData,
  SetAvailabilityRequest,
  CreateEventRequest,
  MapAssignment,
  MapGamePlan,
  MatchGamePlan,
} from './calendar.types';

