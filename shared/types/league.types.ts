// League teams: the teams of the leagues played on competitive.eva.gg, as our
// directory of them lists them

/** A league team as a search lists it: enough for a player to know their own */
export interface LeagueTeamSummary {
  id: string; // Its id on competitive.eva.gg
  name: string;
  memberCount: number;
  logoUrl: string | null; // Where the app loads its logo from; null when it has none
}
