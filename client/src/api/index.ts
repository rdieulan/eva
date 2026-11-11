// API barrel - centralized exports for all API functions

// Players API
export {
  fetchPlayers,
  getPlayers,
  getPlayerById,
  getPlayerName,
  clearPlayersCache,
  fetchMySubscription,
  updateMySubscription,
  fetchMyEvaAccount,
  linkMyEvaAccount,
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

// Scrim searches API
export {
  fetchScrimSearches,
  createScrimSearch,
  updateScrimSearch,
  deleteScrimSearch,
  cancelScrimMatch,
  createScrimProposal,
  acceptScrimProposal,
  declineScrimProposal,
  withdrawScrimProposal,
  fetchVenueBoard,
} from '@/api/scrims.api';

// Notifications API
export {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
} from '@/api/notifications.api';

// Balance Rules
export { clearBalanceRulesCache } from '@/composables/useBalanceRules';

// Teams API
export {
  fetchCurrentTeam,
  createTeam,
  fetchVenues,
  fetchVenueSlots,
  uploadTeamLogo,
  deleteTeamLogo,
  linkTeamDiscord,
  unlinkTeamDiscord,
  setTeamLeagueTeam,
  updateTeam,
  fetchTeamMembers,
  updateMemberPermissions,
  removeMember,
  transferLeadership,
  deleteTeam,
  leaveTeam,
  createInvite,
  fetchInvites,
  revokeInvite,
  verifyInviteCode,
  joinTeamWithCode,
} from '@/api/teams.api';
export type { TeamMember, TeamWithMembers, CreatedTeam, TeamLeagueLink, TeamInvite, InviteValidation, JoinResult } from '@/api/teams.api';

// Home dashboard API
export { fetchDashboard, checkLeagueRegistration, answerCompetitionOffer } from '@/api/dashboard.api';

// League teams API
export { searchLeagueTeams, fetchLeagueTeam, fetchLeagueVenueProposal } from '@/api/league.api';

// Requests to join a team API
export {
  fetchMyJoinRequest,
  sendJoinRequest,
  cancelMyJoinRequest,
  markMyRefusalSeen,
  fetchTeamJoinRequests,
  acceptJoinRequest,
  refuseJoinRequest,
} from '@/api/join-requests.api';

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
  deletePlayer as deleteAdminPlayer,
  freePlayerEvaAccount,
  fetchAdminTeams,
  fetchAdminTeamDetail,
  deleteTeam as deleteAdminTeam,
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

// Venue manager API
export {
  fetchManagedVenues,
  fetchVenueSettings,
  refreshVenueSettings,
  linkVenueDiscord,
  unlinkVenueDiscord,
  fetchVenueDivisions,
  saveVenueDivisions,
  readVenueDivisions,
  fetchVenueCompetitions,
  createVenueCompetition,
  deleteVenueCompetition,
} from '@/api/manager.api';
