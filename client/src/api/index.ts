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

// Teams API
export {
  fetchCurrentTeam,
  createTeam,
  fetchTeamLocations,
  updateTeam,
  fetchTeamMembers,
  updateMemberPermissions,
  removeMember,
  deleteTeam,
} from '@/api/teams.api';
export type { TeamMember, TeamWithMembers } from '@/api/teams.api';
