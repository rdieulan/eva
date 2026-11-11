// The home dashboard: what a player of a team has to do, or to know, soon. Each
// item stops being of use at a moment, its due, and the most pressing come
// first; those with none come last.

/** A match of the coming week, with what eva.gg counts of its bookings */
export interface DashboardMatch {
  eventId: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  title: string;
  venueName: string | null;
  arenaNumber: number | null;
  evaLocationId: number | null; // The venue on eva.gg, where to book a seat
  // The players booked on its slots, the fewest when they differ: eva.gg gives
  // the count, never the names. Null when the match has no slot, or eva.gg did not answer.
  headcount: { takenSeats: number; varies: boolean } | null;
  isUnavailable: boolean; // The reader said they cannot play that day
}

/** The days ahead the reader has given no availability for */
export interface DashboardAvailability {
  missingDays: number;
  horizonDays: number;      // How far ahead the team asks for it
  firstMissingDate: string; // YYYY-MM-DD
}

/** A month of the team's local league open to registration, the team not registered */
export interface DashboardLeagueRegistration {
  tournamentId: string;
  tournamentName: string;
  leagueTeamName: string; // The team as competitive.eva.gg names it, where it registers
  closesAt: string; // ISO date-time
}

/** A match another team proposed on the team's search, waiting for an answer */
export interface DashboardScrimProposal {
  proposalId: string;
  searchId: string;
  teamId: string;   // The team proposing
  teamName: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  venueId: string;
  venueName: string;
  arenaNumber: number | null;
}

/** A competition the team's venue published for it, to add to its calendar or refuse */
export interface DashboardCompetitionOffer {
  competitionId: string;
  venueName: string;
  division: number | null; // The division whose day it is; null for a tournament of the venue
  title: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  description: string | null;
}

/** What the dashboard lists, kind by kind. `due` is the moment it stops being of use, in Paris time (YYYY-MM-DDTHH:mm). */
export type DashboardItem =
  | { kind: 'MATCH'; due: string; data: DashboardMatch }
  | { kind: 'AVAILABILITY'; due: string; data: DashboardAvailability }
  | { kind: 'LEAGUE_REGISTRATION'; due: string; data: DashboardLeagueRegistration }
  | { kind: 'SCRIM_PROPOSAL'; due: string; data: DashboardScrimProposal }
  | { kind: 'COMPETITION_OFFER'; due: string; data: DashboardCompetitionOffer }
  | { kind: 'JOIN_REQUESTS'; due: null; data: { count: number } };

/** The team's next match beyond the coming week */
export interface DashboardNextMatch {
  eventId: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  title: string;
}

/** The home dashboard of a player of a team, the most pressing first */
export interface Dashboard {
  items: DashboardItem[];
  // With nothing to do: the team's next match all the same, when it has one
  // (beyond the coming week, whose matches are items). Null otherwise.
  nextMatch: DashboardNextMatch | null;
}
