// Venue utilities shared by the eva.gg sync (server) and the admin screens (client)
//
// No path aliases here: the sync script loads this file with tsx, which does
// not resolve them.

/**
 * A link a venue can be reached at, or null when there is none worth keeping.
 * Only an absolute http(s) URL is kept: that is the only thing we can turn into
 * a link, and it rules out javascript: and friends from any source.
 */
export function normalizeLinkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null;
}

/**
 * Whether a link given by hand is acceptable: empty is fine (no link), anything
 * else has to be an absolute http(s) URL.
 */
export function isAcceptableLinkInput(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string') return false;
  return !value.trim() || normalizeLinkUrl(value) !== null;
}

// The accents a decomposed name keeps apart from its letters
const DIACRITICS = /[\u0300-\u036f]/g;
const NOT_IN_ADDRESS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

/**
 * A venue's name as it reads in the address of its public board: lowercase,
 * accents dropped, a dash between words ("Toulouse Blagnac" gives
 * "toulouse-blagnac"). A name with nothing left to keep reads "salle".
 */
export function slugifyVenueName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(NOT_IN_ADDRESS, '-')
    .replace(EDGE_DASHES, '');
  return slug || 'salle';
}

/**
 * The address name of a new venue: its name slugified, or the first of
 * name-2, name-3… that no other venue holds yet. Set once: a venue renamed
 * later keeps it, so the links already shared keep working.
 */
export function freeVenueSlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugifyVenueName(name);
  if (!taken.has(base)) return base;
  let rank = 2;
  while (taken.has(`${base}-${rank}`)) rank++;
  return `${base}-${rank}`;
}

/**
 * A venue's public board in words: the same on its page and wherever its link
 * is posted
 */
export function describeVenueBoard(venueName: string): { title: string; lead: string } {
  return { title: `Scrims à ${venueName}`, lead: 'Les équipes qui cherchent un adversaire, jour par jour.' };
}

/**
 * Where a match is played: the venue, and its arena when it is named (a venue
 * with several arenas). Takes the venue's name as shown (formatVenueLabel on
 * the client, the stored name on the server).
 */
export function formatVenuePlace(venueLabel: string, arenaNumber: number | null | undefined): string {
  return arenaNumber ? `${venueLabel} — arène ${arenaNumber}` : venueLabel;
}
