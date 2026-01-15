// Shared types barrel export
// Types only - no functions here

export type { Point, Zone, ZoneRect, ZonePolygon, ZoneMulti } from './zone.types';
export type { Player, PlayerAssignment } from './player.types';
export type {
  GamePhase,
  PhaseZones,
  PhaseNotes,
  RoleNotes,
  RolePhaseNotes,
  GamePlanNotes,
  GamePlan,
  GamePlanSummary,
  Assignment,
  MapConfig,
  AppState,
  MarkerIcon,
  Marker,
  PhaseMarkers,
} from './map.types';
export {
  GAME_PHASES,
  PHASE_LABELS,
  DEFAULT_PHASE_NOTES,
  DEFAULT_ROLE_PHASE_NOTES,
  DEFAULT_GAME_PLAN_NOTES,
  MARKER_ICONS,
  MARKER_SIZES,
  DEFAULT_MARKER_SIZE,
  DEFAULT_PHASE_MARKERS,
} from './map.types';

// Re-export utils for convenience
export {
  getZoneForPhase,
  isLegacyAssignment,
  migrateAssignmentToPhases,
  migrateMapConfigToPhases,
} from '../utils';
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

