// eva.gg account types

// The eva.gg account a player linked from their profile
export interface EvaAccountLink {
  userId: number;   // User id on eva.gg, stable across renames
  username: string; // eva.gg tag (Pseudo#123456) as it was when linked
  linkedAt: string; // ISO date-time
}

// What a player sends to link their eva.gg account
export interface LinkEvaAccountRequest {
  username: string;
}
