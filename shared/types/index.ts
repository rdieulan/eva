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
  GamePlanData,
  Assignment,
  MapConfig,
  AppState,
  MarkerIcon,
  Marker,
  PhaseMarkers,
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
} from './calendar.types';

export type {
  MapAssignment,
  MapGamePlan,
  MatchGamePlan,
} from './map.types';

export type {
  PlannerPermissions,
  CalendarPermissions,
  TeamPermissions,
  AccountPermissions,
  ManagerPermissions,
  AdminPermissions,
} from './permissions.types';
export {
  DEFAULT_PLAYER_PERMISSIONS,
  LEADER_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
} from './permissions.types';

export type {
  Team,
  TeamWithMembers,
  TeamLocation,
} from './team.types';
export { TEAM_LOCATIONS } from './team.types';

export type {
  BalanceSeverity,
  RuleKey,
  BalanceRule,
  BalanceRuleCreate,
  BalanceRuleUpdate,
  BalanceValidation,
  BalanceCheckResult,
} from './balance.types';
export { DEFAULT_BALANCE_RULES } from './balance.types';

export type {
  Account,
  AccountType,
  LinkedAccount,
} from './account.types';

export type {
  LoginResponse,
  LoginCredentials,
} from './auth.types';

export type { Venue } from './venue.types';
