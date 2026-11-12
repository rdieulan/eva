// Requests to join a team: a player without a team asks to join one found
// through its league team; its leader and the members who may invite answer

/** Waiting for the team's answer, refused by it, or taken back by the player. Mirrors the JoinRequestStatus enum in prisma/schema.prisma. */
export type JoinRequestStatus = 'PENDING' | 'REFUSED' | 'CANCELLED';

/** The request of the player reading: the one waiting, or a refusal they have not seen; one they took back is never shown */
export interface MyJoinRequest {
  id: string;
  status: Exclude<JoinRequestStatus, 'CANCELLED'>;
  team: { id: string; name: string; logoUrl: string | null };
  createdAt: string; // ISO date-time
}

/** A request waiting on the team page, for those who answer it */
export interface TeamJoinRequestView {
  id: string;
  playerName: string;
  evaUsername: string | null; // The eva.gg tag the player linked, for the team to know who asks
  createdAt: string; // ISO date-time
}
