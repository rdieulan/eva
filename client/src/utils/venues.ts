// Venue display helpers

import type { Venue } from '@shared/types';

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
