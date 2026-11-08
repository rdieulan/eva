// Scrim matchmaking: a team offers slots of one venue or more, for a day, to
// whoever wants to play against it

/**
 * Where a search stands. Mirrors the ScrimSearchStatus enum in
 * prisma/schema.prisma. A search stays open until it has all its matches, its
 * remaining slots no longer hold one, its day passes or its team withdraws it:
 * MATCHED when it made matches, EXPIRED when it made none. A search withdrawn
 * before its first match is deleted, not kept.
 */
export const SCRIM_SEARCH_STATUSES = ['OPEN', 'MATCHED', 'EXPIRED'] as const;

export type ScrimSearchStatus = typeof SCRIM_SEARCH_STATUSES[number];

// The team behind a search, as shown to the other teams
export interface ScrimSearchTeam {
  id: string;
  name: string;
  logoUrl: string | null;
}

/**
 * Where a proposal stands. Mirrors the ScrimProposalStatus enum in
 * prisma/schema.prisma. CANCELLED: accepted, then the match called off by one
 * of the two teams.
 */
export const SCRIM_PROPOSAL_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'CANCELLED'] as const;

export type ScrimProposalStatus = typeof SCRIM_PROPOSAL_STATUSES[number];

/**
 * Why a proposal was declined: by the team that searches, or by the app once
 * the proposal no longer held. Mirrors the ScrimDeclineReason enum in
 * prisma/schema.prisma.
 */
export const SCRIM_DECLINE_REASONS = [
  'BY_TEAM',          // The team that searches said no
  'TIME_TAKEN',       // It accepted another match at that time
  'SEARCH_FILLED',    // Its search found all its matches
  'SEARCH_CLOSED',    // Its search closed: the slots left no longer hold a match
  'RUN_TAKEN',        // A slot of the run was booked at the venue meanwhile
  'SEARCH_CHANGED',   // Its search changed and no longer holds the run
  'SEARCH_WITHDRAWN', // Its search was withdrawn
  'DAY_PASSED',       // The day passed with no answer
] as const;

export type ScrimDeclineReason = typeof SCRIM_DECLINE_REASONS[number];

// Where a proposal stands, and why when it was declined
export type ScrimProposalOutcome =
  | { status: 'DECLINED'; declineReason: ScrimDeclineReason }
  | { status: Exclude<ScrimProposalStatus, 'DECLINED'>; declineReason: null };

// A team's answer to a search, naming the run it wants to play among the
// offered slots, in one of the venues. The searching team sees every proposal
// on its search; another team only sees its own.
export type ScrimProposal = ScrimProposalOutcome & {
  id: string;
  searchId: string;
  team: ScrimSearchTeam; // The team proposing
  message: string | null;
  venueId: string;         // Where the run is played
  evaSlotIds: string[];    // The run: consecutive slots on one arena, in order
  arenaNumber: number;
  startTime: string;       // HH:mm, first slot of the run
  endTime: string;         // HH:mm, last slot of the run
  convocationTime: string; // HH:mm, for the first slot
  isMine: boolean; // Sent by the reader's own team
  createdAt: string;
};

// A slot a search offers: where and when, as eva.gg gave it when the search opened
export interface ScrimOfferedSlot {
  slotId: string;          // Opaque eva.gg id
  venueId: string;
  arenaNumber: number;
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  convocationTime: string; // HH:mm
}

// A team's offer for a day: slots of one venue or more, and the matches it
// wants to play on them that day, wherever they are played; an opponent picks
// the run of a match among them. A team plays one match at a time, so no two
// matches of a search overlap.
export interface ScrimSearch {
  id: string;
  team: ScrimSearchTeam;
  date: string;            // YYYY-MM-DD
  slots: ScrimOfferedSlot[]; // Venue by venue in the team's order, arena by arena, then by time
  slotCount: number;       // How many consecutive slots a match takes
  matchCount: number;      // How many matches the team wants to play that day
  matchedCount: number;    // How many it already has
  takenSlotIds: string[];  // Offered slots no other match can take: at the time of a match already made
  startTime: string;       // HH:mm, earliest offered slot
  endTime: string;         // HH:mm, end of the latest offered slot
  convocationTime: string; // HH:mm, when eva.gg expects the players for the earliest slot
  status: ScrimSearchStatus;
  isMine: boolean;         // Posted by the reader's own team
  proposals: ScrimProposal[]; // All of them on the reader's own search, only the reader's team's otherwise
  createdAt: string;
}

// A stretch of a search's offer in one venue: consecutive slots on one arena,
// long enough for a match and at no time of a match already made
export interface ScrimOfferRange {
  arenaNumber: number;
  startTime: string; // HH:mm, start of the first slot
  endTime: string;   // HH:mm, end of the last slot
}

// A search as the public board of a venue shows it to anyone: the team, the
// day, where a match still fits in that venue, and what the team wants
export interface PublicScrimSearch {
  id: string;
  date: string;              // YYYY-MM-DD
  team: ScrimSearchTeam;
  ranges: ScrimOfferRange[]; // In the board's venue, by start, then by arena
  slotCount: number;         // How many consecutive slots a match takes
  matchCount: number;        // How many matches the team wants that day
  matchedCount: number;      // How many it already has
}

// The public board of a venue, readable without an account: the open
// searches to come where a match still fits there
export interface VenueBoard {
  venue: { id: string; slug: string; name: string; arenaCount: number };
  searches: PublicScrimSearch[]; // By day, then by their first stretch
}

// What a team sends to answer a search: the run it wants to play, and a word
export interface CreateScrimProposalRequest {
  evaSlotIds: string[];
  message?: string;
}

// The slots a team offers in one venue
export interface ScrimVenueOffer {
  venueId: string;
  evaSlotIds: string[];
}

// What a team sends to open a search: the server reads the rest from the venues' slots
export interface CreateScrimSearchRequest {
  date: string;              // YYYY-MM-DD
  venues: ScrimVenueOffer[]; // A venue at most once, in the team's order
  slotCount: number;         // How many consecutive slots a match takes
  matchCount: number;        // How many matches the team wants to play that day
}

// A change to an open search: everything but its day
export type UpdateScrimSearchRequest = Omit<CreateScrimSearchRequest, 'date'>;
