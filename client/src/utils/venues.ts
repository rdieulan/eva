// Venue display helpers

import type { Venue, VenueLinkKey } from '@shared/types';

// Compare names the way a reader does: "Nîmes" and "NIMES" are the same town
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Label of a venue for the pickers and the event screens.
 *
 * eva.gg names most venues after the town they are in, so repeating the city
 * would give "Nîmes - Nimes" or "Toulouse Blagnac - Blagnac". The city is only
 * worth showing when it says something the name does not, which is the case
 * when the arena sits in a neighbouring town: "Cannes - Mougins".
 */
export function formatVenueLabel(venue: Pick<Venue, 'name' | 'city'>): string {
  const name = venue.name.trim();
  const city = venue.city.trim();

  return normalize(name).includes(normalize(city)) ? name : `${name} - ${city}`;
}

/**
 * The venues the matchmaking calendar can show, split between the team's own
 * (affiliated venue first, then favorites in the team's order) and the rest of
 * the network. Only venues linked to eva.gg have slots to show.
 */
export function splitMatchmakingVenues(
  venues: Venue[],
  team: { venueId?: string | null; favoriteVenueIds: string[] } | null,
): { quick: Venue[]; others: Venue[] } {
  const linked = venues.filter(venue => venue.hasEvaSlots);
  const quickIds = [...(team?.venueId ? [team.venueId] : []), ...(team?.favoriteVenueIds ?? [])];
  const quick = [...new Set(quickIds)]
    .map(id => linked.find(venue => venue.id === id))
    .filter((venue): venue is Venue => venue !== undefined);
  const others = linked
    .filter(venue => !quick.includes(venue))
    .sort((a, b) => formatVenueLabel(a).localeCompare(formatVenueLabel(b), 'fr'));
  return { quick, others };
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
