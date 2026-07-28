// Player utility functions

import type { AvailabilityStatus, PlayerAvailability } from '@shared/types';

/**
 * Priority order for availability status sorting
 * AVAILABLE -> CONDITIONAL -> UNAVAILABLE -> null (undefined)
 */
const STATUS_PRIORITY: Record<AvailabilityStatus | 'null', number> = {
  AVAILABLE: 0,
  CONDITIONAL: 1,
  UNAVAILABLE: 2,
  null: 3,
};

/**
 * Sort player availabilities by status priority then by name
 * @param players - The player availabilities to sort
 * @returns Sorted array (by status: AVAILABLE > CONDITIONAL > UNAVAILABLE > null, then alphabetically)
 */
export function sortPlayersByAvailability(players: PlayerAvailability[]): PlayerAvailability[] {
  return [...players].sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.status ?? 'null'];
    const priorityB = STATUS_PRIORITY[b.status ?? 'null'];

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.playerName.localeCompare(b.playerName);
  });
}

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

/**
 * Get CSS class for a player availability status
 * @param status - The availability status
 * @returns The CSS class name
 */
export function getPlayerStatusClass(status: AvailabilityStatus | null): string {
  switch (status) {
    case 'AVAILABLE': return 'status-available';
    case 'CONDITIONAL': return 'status-maybe';
    case 'UNAVAILABLE': return 'status-unavailable';
    default: return 'status-unknown';
  }
}

/**
 * Get the next availability status in the cycle
 * @param current - The current status
 * @returns The next status in the cycle
 */
export function getNextAvailabilityStatus(current: AvailabilityStatus | null): AvailabilityStatus {
  switch (current) {
    case null: return 'AVAILABLE';
    case 'AVAILABLE': return 'CONDITIONAL';
    case 'CONDITIONAL': return 'UNAVAILABLE';
    case 'UNAVAILABLE': return 'AVAILABLE';
    default: return 'AVAILABLE';
  }
}

