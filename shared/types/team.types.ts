// Team types

/**
 * Team entity
 */
export interface Team {
  id: string;
  name: string;
  logoUrl: string | null; // Where to load the team's logo from, null when it has none
  venueId?: string;
  favoriteVenueIds: string[]; // The venues the team plays at most often, in the team's order
  availabilityHorizonDays: number; // How many days ahead, today included, its players are asked for their availability
  leaderId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Whether a team, or a venue, posts in a Discord channel: none linked,
 * linked, or linked but refused by Discord since (the webhook deleted)
 */
export type DiscordChannelStatus = 'none' | 'linked' | 'broken';

/**
 * Available team locations (predefined list)
 */
export const TEAM_LOCATIONS = [
  'Europe - West',
  'Europe - East',
  'Europe - North',
  'Europe - South',
  'North America - East',
  'North America - West',
  'South America',
  'Asia - East',
  'Asia - Southeast',
  'Oceania',
  'Middle East',
  'Africa',
] as const;

export type TeamLocation = typeof TEAM_LOCATIONS[number];
