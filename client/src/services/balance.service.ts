// Balance validation service
// Checks if a map configuration has a balanced roster

import type { MapConfig } from '../../../shared/types';
import { getPlayers } from '../api/players.api';

export interface BalanceCheckResult {
  isBalanced: boolean;
  errors: string[];
}

/**
 * Get assignment IDs for a specific user on a map
 */
export function getPlayerAssignments(map: MapConfig, userId: string): number[] {
  const playerAssignment = map.players.find(p => p.userId === userId);
  return playerAssignment?.assignmentIds || [];
}

/**
 * Get user IDs assigned to a specific assignment on a map
 */
export function getAssignmentPlayers(map: MapConfig, assignmentId: number): string[] {
  return map.players
    .filter(p => p.assignmentIds.includes(assignmentId))
    .map(p => p.userId);
}

/**
 * Check if a map has a balanced roster
 * Rules:
 * 1. Each assignment must have at least 2 players
 * 2. Each player must have at least 2 assignments
 * 3. Each player must have at most 2 assignments
 * 4. Two assignments can't be covered by the same pair of players only
 */
export function checkMapBalance(map: MapConfig): BalanceCheckResult {
  const errors: string[] = [];
  const assignmentIds = map.assignments.map(a => a.id);
  const playerList = getPlayers();

  // Build assignment to players mapping
  const assignmentToPlayers: Record<number, string[]> = {};
  for (const assignmentId of assignmentIds) {
    assignmentToPlayers[assignmentId] = getAssignmentPlayers(map, assignmentId);
  }

  // Rule 1: Each assignment must have at least 2 players
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

  // Rule 2: Each player must have at least 2 assignments
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

  // Rule 3: Each player must have at most 2 assignments
  for (const playerAssignment of map.players) {
    if (playerAssignment.assignmentIds.length > 2) {
      const playerName = playerList.find(p => p.id === playerAssignment.userId)?.name || playerAssignment.userId;
      errors.push(`${playerName} a ${playerAssignment.assignmentIds.length} postes (max 2)`);
    }
  }

  // Rule 4: Find duplicate pairs
  const assignmentsWithTwoPlayers: { assignmentId: number; userIds: string[] }[] = [];
  for (const [assignmentIdStr, userIds] of Object.entries(assignmentToPlayers)) {
    if (userIds.length === 2) {
      assignmentsWithTwoPlayers.push({
        assignmentId: Number(assignmentIdStr),
        userIds: userIds.sort()
      });
    }
  }

  const pairToAssignments: Record<string, number[]> = {};
  for (const { assignmentId, userIds } of assignmentsWithTwoPlayers) {
    const pairKey = userIds.join('-');
    if (!pairToAssignments[pairKey]) {
      pairToAssignments[pairKey] = [];
    }
    pairToAssignments[pairKey]!.push(assignmentId);
  }

  for (const [pairKey, assignmentIdList] of Object.entries(pairToAssignments)) {
    if (assignmentIdList.length > 1) {
      const pair = pairKey.split('-');
      const playerNames = pair.map(uid => playerList.find(p => p.id === uid)?.name || uid);
      const assignmentNames = assignmentIdList.map(aid => {
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

