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
