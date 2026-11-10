// League teams: the teams of the leagues played on competitive.eva.gg, as our
// directory of them lists them

/** A league team as a search lists it: enough for a player to know their own */
export interface LeagueTeamSummary {
  id: string; // Its id on competitive.eva.gg
  name: string;
  memberCount: number;
  logoUrl: string | null; // Where the app loads its logo from; null when it has none
  team: { id: string; name: string } | null; // The team of ours linked to it, when there is one
}

/** The venue of ours a league team plays its local league at, as its tournaments tell it */
export interface LeagueVenueProposal {
  venueId: string;
  venueName: string;
  leagueName: string; // The tournament it is read from, the most recent: "NEMAUSUS LEAGUE - NOVEMBRE"
}

/** A venue a manager manages */
export interface ManagedVenue {
  id: string;
  name: string;
  city: string;
}

/** A league team where the manager of a venue places it: a division, 1 the top, or none yet */
export interface DivisionPlace {
  leagueTeam: LeagueTeamSummary;
  division: number | null;
}

/** The divisions of a venue's local league, as its manager arranges them; each column in order */
export interface VenueDivisions {
  venueId: string;
  venueName: string;
  divisionCount: number;
  places: DivisionPlace[];
}

/** The divisions of the last drawn month of a venue's league, read from competitive.eva.gg */
export interface VenueDivisionsRead {
  tournamentName: string; // "NEMAUSUS LEAGUE - OCTOBRE"
  divisionCount: number;
  places: DivisionPlace[];
}
