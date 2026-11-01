// Availability display helpers

import type { AvailabilityStatus, PlayerAvailability } from '@shared/types';
import { AVAILABILITY_STATUSES } from '@shared/types';
import { TEAM_PLAYER_COUNT } from '@shared/constants';
import type { TeamAvailabilityStatus } from '@shared/utils';

// Shown behind a day in edit mode: a text glyph, or an icon of SvgIcon
export type AvailabilitySymbol = { text: string } | { icon: string };

export interface AvailabilityDisplay {
  label: string; // Short label of the legend
  title: string; // Full meaning, for tooltips
  symbol: AvailabilitySymbol;
}

// Keyed by AvailabilityStatus: a new status does not compile until it says how it is displayed.
// Colours live alongside in $availability-styles (styles/_variables.scss).
const AVAILABILITY_DISPLAY: Record<AvailabilityStatus, AvailabilityDisplay> = {
  AVAILABLE: { label: 'Dispo', title: 'Disponible', symbol: { text: '✓' } },
  CONDITIONAL: { label: 'Possible', title: 'Disponibilité possible', symbol: { text: '~' } },
  VOICE_ONLY: { label: 'Vocal', title: 'Dispo pour le vocal uniquement', symbol: { icon: 'mic' } },
  UNAVAILABLE: { label: 'Indispo', title: 'Indisponible', symbol: { text: '✗' } },
};

const UNSET_DISPLAY: AvailabilityDisplay = { label: '?', title: 'Non renseigné', symbol: { text: '?' } };

/**
 * Get the label, meaning and symbol of an availability status (null = not set)
 */
export function getAvailabilityDisplay(status: AvailabilityStatus | null): AvailabilityDisplay {
  return status ? AVAILABILITY_DISPLAY[status] : UNSET_DISPLAY;
}

/**
 * Get the CSS modifier of an availability status, matching the keys of $availability-styles
 * @returns e.g. "availability--voice-only", or "availability--unset" when not set
 */
export function getAvailabilityClass(status: AvailabilityStatus | null): string {
  return `availability--${status ? status.toLowerCase().replace(/_/g, '-') : 'unset'}`;
}

// Keyed by TeamAvailabilityStatus, what a day's colour means in matchmaking mode.
// Colours live alongside in $team-availability-colors (styles/_variables.scss).
const TEAM_AVAILABILITY_DISPLAY: Record<TeamAvailabilityStatus, Pick<AvailabilityDisplay, 'label' | 'title'>> = {
  ready: { label: `${TEAM_PLAYER_COUNT} dispos`, title: `Au moins ${TEAM_PLAYER_COUNT} joueurs disponibles` },
  shaky: { label: `${TEAM_PLAYER_COUNT} possibles`, title: `${TEAM_PLAYER_COUNT} joueurs en comptant les disponibilités possibles` },
  short: { label: `Moins de ${TEAM_PLAYER_COUNT}`, title: `Moins de ${TEAM_PLAYER_COUNT} joueurs mobilisables` },
  unknown: { label: '?', title: 'Personne n\'a encore renseigné sa disponibilité' },
};

export const TEAM_AVAILABILITY_STATUSES: readonly TeamAvailabilityStatus[] = ['ready', 'shaky', 'short', 'unknown'];

/**
 * Get the label and meaning of a team-level availability
 */
export function getTeamAvailabilityDisplay(status: TeamAvailabilityStatus): Pick<AvailabilityDisplay, 'label' | 'title'> {
  return TEAM_AVAILABILITY_DISPLAY[status];
}

/**
 * Get the CSS modifier of a team-level availability, matching the keys of
 * $team-availability-colors. A day nobody answered for looks like a day the
 * player has not set: the same neutral style.
 */
export function getTeamAvailabilityClass(status: TeamAvailabilityStatus): string {
  return status === 'unknown' ? getAvailabilityClass(null) : `team-availability--${status}`;
}

/**
 * Get the status that follows in the click cycle: through AVAILABILITY_STATUSES, then back to not set
 */
export function getNextAvailabilityStatus(current: AvailabilityStatus | null): AvailabilityStatus | null {
  if (current === null) return AVAILABILITY_STATUSES[0];
  return AVAILABILITY_STATUSES[AVAILABILITY_STATUSES.indexOf(current) + 1] ?? null;
}

// Rank in AVAILABILITY_STATUSES order, "not set" last
function availabilityRank(status: AvailabilityStatus | null): number {
  return status ? AVAILABILITY_STATUSES.indexOf(status) : AVAILABILITY_STATUSES.length;
}

/**
 * Sort player availabilities from most to least available, then by name
 */
export function sortPlayersByAvailability(players: PlayerAvailability[]): PlayerAvailability[] {
  return [...players].sort((a, b) =>
    availabilityRank(a.status) - availabilityRank(b.status) || a.playerName.localeCompare(b.playerName),
  );
}
