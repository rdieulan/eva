// Player data helper functions

import type { PlayerAssignment } from '@shared/types';

export interface GamePlanPlayerWithUser {
  playerId: string;
  assignmentIds: number[];
  mainAssignmentId: number | null;
  player?: {
    user?: {
      id: string;
    } | null;
  } | null;
}

/**
 * Transform GamePlanPlayer records for frontend consumption
 * Returns playerId for frontend use
 */
export function mapPlayersForFrontend(
  players: GamePlanPlayerWithUser[]
): PlayerAssignment[] {
  return players.map(p => ({
    playerId: p.playerId,
    assignmentIds: p.assignmentIds,
    mainAssignmentId: p.mainAssignmentId ?? undefined,
  }));
}
