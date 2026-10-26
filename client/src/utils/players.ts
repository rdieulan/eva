// Player utility functions

/**
 * Get initials from a player name
 * @param name - The player name
 * @returns The initials (first letter of each word, max 2)
 */
export function getPlayerInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Max characters shown in a badge before we give up disambiguating and let the
// full-name tooltip do the work. Kept short so labels stay readable in the tiny
// avatar circle.
const MAX_BADGE_LEN = 3;

/**
 * Compute short, roster-unique badge labels for a set of players.
 *
 * The label is derived from the whole set (not per day) so a given pseudo always
 * shows the same badge. It starts from the usual initials (1 letter for a
 * single-word pseudo, 2 for a multi-word name) and only grows — up to
 * {@link MAX_BADGE_LEN} chars — for pseudos that would otherwise collide, e.g.
 * "Alex"/"Alice"/"Anna" -> "Ale"/"Ali"/"An". Pseudos that still collide past the
 * cap share a label and rely on the full-name tooltip. Keyed by playerId, so it
 * is agnostic to whether ids are User.ids or Player.ids.
 *
 * @param players - The players to label (playerId must be unique per player)
 * @returns A map of playerId -> badge label
 */
export function computePlayerInitials(
  players: { playerId: string; playerName: string }[]
): Record<string, string> {
  // Compact token per player: word-initials for multi-word names
  // ("Jean Dupont" -> "JD"), the bare pseudo for single-word names.
  const entries = players.map(p => {
    const words = p.playerName.trim().split(/\s+/).filter(Boolean);
    const token = (words.length > 1 ? words.map(w => w[0]).join('') : words[0] ?? '?').toUpperCase();
    // Preserve the current look when there is no collision: 1 char for a
    // single-word pseudo, 2 for a multi-word name.
    const startLen = Math.min(words.length > 1 ? 2 : 1, token.length);
    return { playerId: p.playerId, token, startLen };
  });

  const labels: Record<string, string> = {};

  for (const entry of entries) {
    let len = entry.startLen;
    // Grow the prefix until it no longer matches any other player's prefix of
    // the same length (comparing at the same length keeps the check symmetric).
    while (len < MAX_BADGE_LEN) {
      const candidate = entry.token.slice(0, len);
      const collides = entries.some(
        other => other.playerId !== entry.playerId && other.token.slice(0, len) === candidate
      );
      if (!collides) break;
      len++;
    }
    labels[entry.playerId] = entry.token.slice(0, len) || '?';
  }

  return labels;
}

