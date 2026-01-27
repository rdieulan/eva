// Player data helper functions

export interface PlayerAssignment {
  userId: string;
  assignmentIds: number[];
  mainAssignmentId: number | null;
}

/**
 * Transform GamePlanPlayer records for frontend consumption
 */
export function mapPlayersForFrontend(
  players: { userId: string; assignmentIds: number[]; mainAssignmentId: number | null }[]
): PlayerAssignment[] {
  return players.map(p => ({
    userId: p.userId,
    assignmentIds: p.assignmentIds,
    mainAssignmentId: p.mainAssignmentId,
  }));
}
