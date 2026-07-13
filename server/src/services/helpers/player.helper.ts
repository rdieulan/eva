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
 * Transform GamePlanPlayer records for frontend consumption.
 *
 * The frontend identifies players by their linked User.id (that is what
 * /api/players and /api/teams/current/members expose), whereas the
 * GamePlanPlayer.playerId column is a Player.id foreign key. We therefore
 * expose the linked user's id here — the write path (plans.service.updatePlan)
 * translates it back to a Player.id. Rows whose Player has no linked User can't
 * be represented in the frontend's id space and are dropped.
 */
export function mapPlayersForFrontend(
  players: GamePlanPlayerWithUser[]
): PlayerAssignment[] {
  return players
    .filter(p => p.player?.user?.id)
    .map(p => ({
      playerId: p.player!.user!.id,
      assignmentIds: p.assignmentIds,
      mainAssignmentId: p.mainAssignmentId ?? undefined,
    }));
}
