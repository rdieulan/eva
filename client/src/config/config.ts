// Configuration and data loading


// =============================================================================
// CONFIGURATION
// =============================================================================

// Assignment colors (fixed for all maps, by assignment ID)
export const assignmentColors: Record<number, string> = {
  1: '#ff6b6b',
  2: '#4ecdc4',
  3: '#ffe66d',
  4: '#a66cff',
};

// Get color for an assignment ID (with fallback)
export function getAssignmentColor(assignmentId: number): string {
  return assignmentColors[assignmentId] || '#888888';
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

export {
  fetchPlayers as loadPlayers,
  getPlayers,
  getPlayerById,
  getPlayerName,
  clearPlayersCache
} from '@/api/players.api';

export {
  fetchAllMaps as loadAllMaps,
  fetchMap as loadMap,
  saveGamePlan,
  fetchGamePlan,
  fetchGamePlans,
  createGamePlan,
  deleteGamePlan,
} from '@/api/maps.api';

// =============================================================================
// BALANCE VALIDATION
// =============================================================================

export {
  checkMapBalance,
  getPlayerAssignments,
  getPlayerMainAssignment,
  getAssignmentPlayers,
} from '@/services/balance.service';

