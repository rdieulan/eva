// Venue types

/**
 * Where a venue can be reached online. The same list eva.gg publishes for its
 * locations, plus their website; venues created by hand fill them in the admin.
 */
export const VENUE_LINK_KEYS = ['website', 'discord', 'facebook', 'instagram', 'x', 'tiktok', 'youtube', 'twitch'] as const;

export type VenueLinkKey = typeof VENUE_LINK_KEYS[number];

// One URL per network, null when the venue has none there
export type VenueLinks = Record<VenueLinkKey, string | null>;

/**
 * Public venue data (visible by all authenticated users)
 */
export interface Venue extends VenueLinks {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  arenaCount: number; // Arenas available for play, numbered 1 to arenaCount
  hasEvaSlots: boolean; // Filled from eva.gg, so its slots can be listed per day
}

// One slot of a venue on a given day: one arena, one start time
export interface VenueSlot {
  slotId: string;          // Opaque eva.gg id, the one bookings carry
  startTime: string;       // HH:mm, when play starts
  endTime: string;         // HH:mm
  convocationTime: string; // HH:mm, when players are expected; what eva.gg shows them
  arenaNumber: number;
  takenSeats: number; // Players already booked on the slot
  totalSeats: number; // Capacity of the slot as eva.gg opened it
}
