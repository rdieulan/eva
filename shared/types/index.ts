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
  AvailabilityHours,
  EventType,
  VoiceMedium,
  Availability,
  CalendarEvent,
  EventVenue,
  PlayerAvailability,
  DayData,
  MonthData,
  CalendarTarget,
  SetAvailabilityRequest,
  CreateEventRequest,
} from './calendar.types';
export { AVAILABILITY_STATUSES, EVENT_TYPES, VOICE_MEDIUMS } from './calendar.types';

export type {
  ScrimSearchStatus,
  ScrimSearchTeam,
  ScrimSearch,
  ScrimOfferedSlot,
  ScrimVenueOffer,
  CreateScrimSearchRequest,
  UpdateScrimSearchRequest,
  ScrimProposalStatus,
  ScrimDeclineReason,
  ScrimProposalOutcome,
  ScrimProposal,
  CreateScrimProposalRequest,
  ScrimOfferRange,
  PublicScrimSearch,
  VenueBoard,
} from './scrim.types';
export { SCRIM_SEARCH_STATUSES, SCRIM_PROPOSAL_STATUSES, SCRIM_DECLINE_REASONS } from './scrim.types';
export type {
  NotificationKind,
  ScrimMatchFacts,
  NotificationContent,
  InboxNotification,
  NotificationInbox,
  MarkNotificationsReadRequest,
  NotificationTarget,
  TeamPageTarget,
  LeagueRegistrationFacts,
  NotificationDescription,
} from './notification.types';
export { NOTIFICATION_KINDS } from './notification.types';

export type { JoinRequestStatus, MyJoinRequest, TeamJoinRequestView } from './join-request.types';

export type { NotificationLook, Subject, SubjectTone } from './subject.types';

export type {
  Dashboard,
  DashboardItem,
  DashboardMatch,
  DashboardAvailability,
  DashboardLeagueRegistration,
  DashboardNextMatch,
  DashboardScrimProposal,
} from './dashboard.types';

export type {
  SubscriptionTier,
  PlayerSubscription,
  SubscriptionRenewal,
} from './subscription.types';
export { SUBSCRIPTION_TIERS } from './subscription.types';

export type {
  MapAssignment,
  MapGamePlan,
  MatchGamePlan,
} from './map.types';

export type {
  PlannerPermissions,
  CalendarPermissions,
  MatchmakingPermissions,
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
  TeamDiscordStatus,
  TeamLocation,
} from './team.types';
export { TEAM_LOCATIONS } from './team.types';

export type {
  DivisionPlace,
  LeagueTeamSummary,
  LeagueVenueProposal,
  ManagedVenue,
  VenueDivisions,
  VenueDivisionsRead,
} from './league.types';

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
  InvitationSummary,
  DevLoginAccount,
} from './account.types';

export type { LoginResponse } from './auth.types';

export type { Venue, VenueSlot, SlotTokenType, VenueLinks, VenueLinkKey } from './venue.types';
export { VENUE_LINK_KEYS } from './venue.types';

export type { EvaAccountLink, LinkEvaAccountRequest } from './eva.types';
