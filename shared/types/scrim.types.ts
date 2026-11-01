// Scrim matchmaking: a team puts a run of slots of a venue up for an opponent

/**
 * Where a search stands. Mirrors the ScrimSearchStatus enum in
 * prisma/schema.prisma. A cancelled search is deleted, not kept.
 */
export const SCRIM_SEARCH_STATUSES = ['OPEN', 'MATCHED'] as const;

export type ScrimSearchStatus = typeof SCRIM_SEARCH_STATUSES[number];

// The team behind a search, as shown to the other teams
export interface ScrimSearchTeam {
  id: string;
  name: string;
  logoUrl: string | null;
}

// A run of consecutive slots on one arena of a venue, on which a team wants to play
export interface ScrimSearch {
  id: string;
  team: ScrimSearchTeam;
  venueId: string;
  date: string;            // YYYY-MM-DD
  arenaNumber: number;
  evaSlotIds: string[];    // The slots, consecutive, in order
  startTime: string;       // HH:mm, first slot
  endTime: string;         // HH:mm, last slot
  convocationTime: string; // HH:mm, when eva.gg expects the players for the first slot
  status: ScrimSearchStatus;
  isMine: boolean;         // Posted by the reader's own team
  createdAt: string;
}

// What a team sends to open a search: the server reads the rest from the venue's slots
export interface CreateScrimSearchRequest {
  venueId: string;
  date: string;        // YYYY-MM-DD
  evaSlotIds: string[];
}
