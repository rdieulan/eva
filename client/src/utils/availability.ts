// Availability display helpers

import type { AvailabilityStatus, PlayerAvailability } from '@shared/types';
import { AVAILABILITY_STATUSES } from '@shared/types';

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
