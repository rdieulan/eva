import type { Player, MapConfig } from '../types';

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

// =============================================================================
// DATA LOADING (from API)
// =============================================================================

// Cache for players (loaded once from API)
let cachedPlayers: Player[] | null = null;

// Load players from API
export async function loadPlayers(): Promise<Player[]> {
  if (cachedPlayers) {
    console.log('[CONFIG] Using cached players:', cachedPlayers.length);
    return cachedPlayers;
  }

  console.log('[CONFIG] Loading players from API...');
  const response = await fetch('/api/players');
  if (!response.ok) {
    throw new Error('Failed to load players from API');
  }
  cachedPlayers = await response.json();
  console.log('[CONFIG] Loaded players:', cachedPlayers);
  return cachedPlayers!;
}

// Get cached players (must call loadPlayers first)
export function getPlayers(): Player[] {
  if (!cachedPlayers) {
    console.error('[CONFIG] getPlayers called before loadPlayers!');
    throw new Error('Players not loaded. Call loadPlayers() first.');
  }
  return cachedPlayers;
}

// Load all maps from API
export async function loadAllMaps(): Promise<MapConfig[]> {
  console.log('[CONFIG] Loading maps from API...');
  const response = await fetch('/api/maps');
  if (!response.ok) {
    throw new Error('Failed to load maps from API');
  }
  const maps = await response.json();
  console.log('[CONFIG] Loaded maps:', maps.length, '- First map players:', maps[0]?.players);
  return maps;
}

// Load a single map from API
export async function loadMap(mapId: string): Promise<MapConfig> {
  const response = await fetch(`/api/maps/${mapId}`);
  if (!response.ok) {
    throw new Error(`Failed to load map: ${mapId}`);
  }
  return response.json();
}

// =============================================================================
// HELPERS
// =============================================================================

// Get assignment IDs for a specific user on a map
export function getPlayerAssignments(map: MapConfig, userId: string): number[] {
  const playerAssignment = map.players.find(p => p.userId === userId);
  return playerAssignment?.assignmentIds || [];
}

// Get user IDs assigned to a specific assignment on a map
export function getAssignmentPlayers(map: MapConfig, assignmentId: number): string[] {
  return map.players
    .filter(p => p.assignmentIds.includes(assignmentId))
    .map(p => p.userId);
}

// Check if a map has a balanced roster
export function checkMapBalance(map: MapConfig): { isBalanced: boolean; errors: string[] } {
  const errors: string[] = [];
  const assignmentIds = map.assignments.map(a => a.id);
  const playerList = getPlayers();

  // For each assignment, find the players covering it
  const assignmentToPlayers: Record<number, string[]> = {};

  for (const assignmentId of assignmentIds) {
    assignmentToPlayers[assignmentId] = getAssignmentPlayers(map, assignmentId);
  }

  // Rule 1: Check if an assignment is covered by less than 2 players
  for (const [assignmentIdStr, userIds] of Object.entries(assignmentToPlayers)) {
    const assignmentId = Number(assignmentIdStr);
    if (userIds.length < 2) {
      const assignment = map.assignments.find(a => a.id === assignmentId);
      const assignmentName = assignment?.name || String(assignmentId);
      if (userIds.length === 0) {
        errors.push(`${assignmentName} n'a aucun joueur`);
      } else {
        const playerName = playerList.find(p => p.id === userIds[0])?.name || userIds[0];
        errors.push(`${assignmentName} n'a que ${playerName}`);
      }
    }
  }

  // Rule 2: Check if a player covers only one assignment
  for (const playerAssignment of map.players) {
    if (playerAssignment.assignmentIds.length < 2) {
      const playerName = playerList.find(p => p.id === playerAssignment.userId)?.name || playerAssignment.userId;
      if (playerAssignment.assignmentIds.length === 0) {
        errors.push(`${playerName} n'a aucun poste`);
      } else {
        const assignment = map.assignments.find(a => a.id === playerAssignment.assignmentIds[0]);
        const assignmentName = assignment?.name || String(playerAssignment.assignmentIds[0]);
        errors.push(`${playerName} n'a que ${assignmentName}`);
      }
    }
  }

  // Rule 3: Check if a player covers more than 2 assignments
  for (const playerAssignment of map.players) {
    if (playerAssignment.assignmentIds.length > 2) {
      const playerName = playerList.find(p => p.id === playerAssignment.userId)?.name || playerAssignment.userId;
      errors.push(`${playerName} a ${playerAssignment.assignmentIds.length} postes (max 2)`);
    }
  }

  // Rule 4: Find assignments covered by exactly 2 players and check for duplicate pairs
  const assignmentsWithTwoPlayers: { assignmentId: number; userIds: string[] }[] = [];

  for (const [assignmentIdStr, userIds] of Object.entries(assignmentToPlayers)) {
    if (userIds.length === 2) {
      assignmentsWithTwoPlayers.push({ assignmentId: Number(assignmentIdStr), userIds: userIds.sort() });
    }
  }

  // Check if two assignments share the same pair of players
  const pairToAssignments: Record<string, number[]> = {};

  for (const { assignmentId, userIds } of assignmentsWithTwoPlayers) {
    const pairKey = userIds.join('-');
    if (!pairToAssignments[pairKey]) {
      pairToAssignments[pairKey] = [];
    }
    pairToAssignments[pairKey]?.push(assignmentId);
  }

  for (const [pairKey, assignmentIds] of Object.entries(pairToAssignments)) {
    if (assignmentIds.length > 1) {
      const pair = pairKey.split('-');
      const playerNames = pair.map(uid => playerList.find(p => p.id === uid)?.name || uid);
      const assignmentNames = assignmentIds.map(aid => {
        const assignment = map.assignments.find(a => a.id === aid);
        return assignment?.name || String(aid);
      });
      errors.push(`${assignmentNames.join(' et ')} sont couverts uniquement par ${playerNames.join(' et ')}`);
    }
  }

  return {
    isBalanced: errors.length === 0,
    errors
  };
}
