// API barrel - centralized exports for all API functions

// Players API
export {
  fetchPlayers,
  getPlayers,
  getPlayerById,
  getPlayerName,
  clearPlayersCache
} from '@/api/players.api';

// Maps API
export {
  fetchAllMaps,
  fetchMap,
  saveGamePlan,
  fetchGamePlan,
  fetchGamePlans,
  createGamePlan,
  deleteGamePlan,
} from '@/api/maps.api';

// Calendar API
export {
  fetchMonthData,
  setAvailability,
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventGamePlan,
} from '@/api/calendar.api';

// Balance Rules
export { clearBalanceRulesCache } from '@/composables/useBalanceRules';

// Teams API
export {
  fetchCurrentTeam,
  createTeam,
  fetchVenues,
  updateTeam,
  fetchTeamMembers,
  updateMemberPermissions,
  removeMember,
  deleteTeam,
  leaveTeam,
  createInvite,
  fetchInvites,
  revokeInvite,
  verifyInviteCode,
  joinTeamWithCode,
} from '@/api/teams.api';
export type { TeamMember, TeamWithMembers, TeamInvite, InviteValidation, JoinResult } from '@/api/teams.api';

// Admin API
export {
  fetchAdminVenues,
  createVenue as createAdminVenue,
  updateVenue as updateAdminVenue,
  deleteVenue as deleteAdminVenue,
  fetchAdminManagers,
  createManager as createAdminManager,
  updateManagerVenues as updateAdminManagerVenues,
  deleteManager as deleteAdminManager,
  fetchAdminAdmins,
  createAdmin as createAdminAdmin,
  updateAdminPermissions as updateAdminAdminPermissions,
  deleteAdmin as deleteAdminAdmin,
  fetchAdminPlayers,
  fetchAdminTeams,
  fetchAdminTeamDetail,
  buildActivationUrl,
} from '@/api/admin.api';
export type {
  ManagerSummary,
  CreatedManager,
  VenueInput,
  AdminSummary,
  CreatedAdmin,
  PlayerAdminSummary,
  TeamAdminSummary,
  TeamAdminDetail,
  TeamAdminMember,
} from '@/api/admin.api';
