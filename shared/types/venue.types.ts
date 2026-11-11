// Venue types

import type { DiscordChannelStatus } from './team.types';

/**
 * Where a venue can be reached online. The same list eva.gg publishes for its
 * locations, plus their website; venues created by hand fill them in the admin.
 */
export const VENUE_LINK_KEYS = ['website', 'discord', 'facebook', 'instagram', 'x', 'tiktok', 'youtube', 'twitch'] as const;

export type VenueLinkKey = typeof VENUE_LINK_KEYS[number];

// One URL per network, null when the venue has none there
export type VenueLinks = Record<VenueLinkKey, string | null>;

/**
 * A venue as its manager's settings show it: its public information, as
 * eva.gg publishes it, and the channel of its own Discord its publications are to go to
 */
export interface VenueSettings extends VenueLinks {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  arenaCount: number;
  isFromEva: boolean;             // Listed by eva.gg, and read again there; otherwise the administration keeps it
  discordChannel: DiscordChannelStatus; // The channel of its own Discord its publications are to go to; never the webhook itself
}

/**
 * Public venue data (visible by all authenticated users)
 */
export interface Venue extends VenueLinks {
  id: string;
  slug: string; // Its name in the address of its public board, /salles/<slug>
  name: string;
  city: string;
  address: string;
  phone: string | null;
  arenaCount: number; // Arenas available for play, numbered 1 to arenaCount
  hasEvaSlots: boolean; // Filled from eva.gg, so its slots can be listed per day
}

// The token an EVA Pass holder spends on a slot: one of peak hours (HP) or of
// off-peak hours (HC)
export type SlotTokenType = 'peak' | 'offPeak';

// One slot of a venue on a given day: one arena, one start time
export interface VenueSlot {
  slotId: string;          // Opaque, one arena at one hour: eva.gg's slot id names the hour, the same on every arena, and the arena follows it
  startTime: string;       // HH:mm, when play starts
  endTime: string;         // HH:mm
  convocationTime: string; // HH:mm, when players are expected; what eva.gg shows them
  arenaNumber: number;
  gameId: number; // Which eva.gg game the slot runs; a match needs COMPETITIVE_GAME_ID
  takenSeats: number; // Players already booked on the slot
  totalSeats: number; // Capacity of the slot as eva.gg opened it
  isCompetitiveAvailable: boolean; // The competitive mode can be booked on it, which a match needs
  tokenType: SlotTokenType | null; // What a pass holder spends on it; null when eva.gg rates it neither way
  // Peak sessions the venue still opens to EVA Pass holders that day, when
  // this slot counts against them; 0: a pass holder can no longer open it
  passQuotaLeft: number | null;
}
