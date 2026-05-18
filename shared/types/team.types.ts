// Team types

/**
 * Team entity
 */
export interface Team {
  id: string;
  name: string;
  logo?: string;
  venueId?: string;
  leaderId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Team with leader and members info
 */
export interface TeamWithMembers extends Team {
  leader: {
    id: string;
    name: string;
    email: string;
  };
  members: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

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
