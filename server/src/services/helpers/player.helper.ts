// Player data helper functions

export interface PlayerAssignment {
  userId: string;
  assignmentIds: number[];
  mainAssignmentId: number | null;
}

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
 * Now expects playerId instead of userId
 */
export function mapPlayersForFrontend(
  players: GamePlanPlayerWithUser[]
): PlayerAssignment[] {
  return players.map(p => ({
    // Get userId from the nested player.user relation if available, otherwise use playerId
    userId: p.player?.user?.id || p.playerId,
    assignmentIds: p.assignmentIds,
    mainAssignmentId: p.mainAssignmentId,
  }));
}
