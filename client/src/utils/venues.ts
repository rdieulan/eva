// Venue display helpers

import type { Venue, VenueLinkKey } from '@shared/types';
import { foldForSearch } from '@shared/utils';

/**
 * Label of a venue wherever the app names it: its name alone. eva.gg names a
 * venue after its town (Nîmes, Toulouse Blagnac, Lyon Nord), the name players
 * know it by. The town of its address, often a neighbouring one (Avignon sits
 * in Le Pontet), only shows in the admin's details of the venue.
 */
export function formatVenueLabel(venue: Pick<Venue, 'name'>): string {
  return venue.name.trim();
}

// The venues of the matchmaking menu, in the order it lists them
export interface MatchmakingVenues {
  affiliated: Venue | null; // The team's own venue, always first
  favorites: Venue[];       // In the team's order
  others: Venue[];          // The rest of the network, alphabetically
}

/**
 * The venues the matchmaking calendar can show: the team's affiliated venue,
 * then its favorites in the team's order, then the rest of the network. Only
 * venues linked to eva.gg have slots to show.
 */
export function groupMatchmakingVenues(
  venues: Venue[],
  team: { venueId?: string | null; favoriteVenueIds: string[] } | null,
): MatchmakingVenues {
  const linked = venues.filter(venue => venue.hasEvaSlots);
  const affiliated = linked.find(venue => venue.id === team?.venueId) ?? null;
  const favorites = [...new Set(team?.favoriteVenueIds ?? [])]
    .map(id => linked.find(venue => venue.id === id))
    .filter((venue): venue is Venue => venue !== undefined && venue !== affiliated);
  const others = linked
    .filter(venue => venue !== affiliated && !favorites.includes(venue))
    .sort((a, b) => formatVenueLabel(a).localeCompare(formatVenueLabel(b), 'fr'));
  return { affiliated, favorites, others };
}

/**
 * Whether a venue answers what the reader typed: in its name or its town,
 * accents and case aside
 */
export function venueMatches(venue: Pick<Venue, 'name' | 'city'>, query: string): boolean {
  const wanted = foldForSearch(query);
  return !wanted || foldForSearch(venue.name).includes(wanted) || foldForSearch(venue.city).includes(wanted);
}

// Keyed by VenueLinkKey: a new network does not compile until it has a label
export const VENUE_LINK_LABELS: Record<VenueLinkKey, string> = {
  website: 'Site web',
  discord: 'Discord',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitch: 'Twitch',
};
