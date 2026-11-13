// Availability display helpers

import type { AvailabilityHours, AvailabilityStatus, PlayerAvailability } from '@shared/types';
import { AVAILABILITY_STATUSES } from '@shared/types';
import { TEAM_PLAYER_COUNT } from '@shared/constants';
import {
  assessTeamAvailability,
  describeAvailabilityHours,
  windowCovers,
  type TeamAvailability,
  type TeamAvailabilityStatus,
} from '@shared/utils';

// The symbol of an answer, in the corner of a day and on the wheel: an icon of
// SvgIcon, drawn, so it sits on the centre of its box at every size, where a
// glyph of a font sits as its font draws it
export type AvailabilitySymbol = { icon: string };

export interface AvailabilityDisplay {
  label: string; // Short label, on the wheel of answers
  title: string; // Full meaning, for tooltips
  symbol: AvailabilitySymbol;
}

// Keyed by AvailabilityStatus: a new status does not compile until it says how it is displayed.
// Colours live alongside in $availability-styles (styles/_variables.scss).
const AVAILABILITY_DISPLAY: Record<AvailabilityStatus, AvailabilityDisplay> = {
  AVAILABLE: { label: 'Dispo', title: 'Dispo pour jouer', symbol: { icon: 'check' } },
  PARTIAL: { label: 'Horaires', title: 'Dispo pour jouer sur une partie de la journée', symbol: { icon: 'clock' } },
  VOICE_ONLY: { label: 'En ligne', title: 'Dispo en ligne seulement, pas en salle', symbol: { icon: 'mic' } },
  UNAVAILABLE: { label: 'Indispo', title: 'Indisponible', symbol: { icon: 'cross' } },
};

const UNSET_DISPLAY: AvailabilityDisplay = { label: 'Indéfini', title: 'Non renseigné', symbol: { icon: 'question-mark' } };

/**
 * Get the label, meaning and symbol of an availability status (null = not set)
 */
export function getAvailabilityDisplay(status: AvailabilityStatus | null): AvailabilityDisplay {
  return status ? AVAILABILITY_DISPLAY[status] : UNSET_DISPLAY;
}

// An hour in a few characters: "21h", "21h30"
function shortHour(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${Number(hours)}h${minutes === '00' ? '' : minutes}`;
}

/**
 * A partial availability in a few characters, for a corner with room for it,
 * a line per bound, the dash on the side the hours run: "20h" over "–23h",
 * "21h–" from then on, "–22h" until then
 */
export function getHoursMark(hours: AvailabilityHours): string[] {
  if (hours.startTime && hours.endTime) return [shortHour(hours.startTime), `–${shortHour(hours.endTime)}`];
  if (hours.startTime) return [`${shortHour(hours.startTime)}–`];
  return [`–${shortHour(hours.endTime!)}`];
}

/**
 * The full meaning of an answer, with its hours when it is partial
 */
export function describeAvailability(status: AvailabilityStatus | null, hours: AvailabilityHours | null): string {
  const { title } = getAvailabilityDisplay(status);
  return status === 'PARTIAL' && hours ? `Dispo pour jouer ${describeAvailabilityHours(hours)}` : title;
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
  ready: { label: `${TEAM_PLAYER_COUNT} dispos`, title: `Au moins ${TEAM_PLAYER_COUNT} joueurs dispos toute la journée` },
  shaky: { label: `${TEAM_PLAYER_COUNT} sur une plage`, title: `${TEAM_PLAYER_COUNT} joueurs ensemble sur une partie de la journée seulement` },
  voice: { label: `${TEAM_PLAYER_COUNT} en vocal`, title: `Au moins ${TEAM_PLAYER_COUNT} joueurs en vocal, pas d'alignement en salle pour l'instant` },
  short: { label: `Moins de ${TEAM_PLAYER_COUNT}`, title: `Moins de ${TEAM_PLAYER_COUNT} joueurs mobilisables` },
  unknown: { label: '?', title: 'Rien d\'acquis pour l\'instant, des joueurs n\'ont pas encore répondu' },
};

export const TEAM_AVAILABILITY_STATUSES: readonly TeamAvailabilityStatus[] = ['ready', 'shaky', 'voice', 'short', 'unknown'];

/**
 * Get the label and meaning of a team-level availability
 */
export function getTeamAvailabilityDisplay(status: TeamAvailabilityStatus): Pick<AvailabilityDisplay, 'label' | 'title'> {
  return TEAM_AVAILABILITY_DISPLAY[status];
}

/**
 * The meaning of what the team can do on a day, with the hours a full lineup
 * meets when it is only part of the day
 */
export function describeTeamAvailability(team: TeamAvailability): string {
  if (team.status === 'shaky' && team.window) {
    return `${TEAM_PLAYER_COUNT} joueurs ensemble ${describeAvailabilityHours(team.window)} seulement`;
  }
  return TEAM_AVAILABILITY_DISPLAY[team.status].title;
}

/** What a full lineup of the team allows on a day, said where the slots of a match are picked */
export interface TeamLineup {
  text: string; // What the team can do that day (see describeTeamAvailability)
  hours: AvailabilityHours | null; // The hours a full lineup meets; null: it meets at no hour
}

/**
 * The lineup of a day, from the answers of the team's players: null when a
 * full lineup covers the whole day, and there is nothing to say
 */
export function teamLineupOf(availabilities: PlayerAvailability[]): TeamLineup | null {
  const team = assessTeamAvailability(availabilities);
  if (team.status === 'ready') return null;
  return { text: describeTeamAvailability(team), hours: team.status === 'shaky' ? team.window : null };
}

/** Whether no full lineup covers the slot: the team meets at no hour that day, or not at the slot's */
export function isOutsideLineup(hours: AvailabilityHours | null, slot: { startTime: string; endTime: string }): boolean {
  return hours === null || !windowCovers(hours, slot);
}

/** How many of the slots picked no full lineup covers; none on a day it covers whole */
export function countOutsideLineup(lineup: TeamLineup | null, slots: { startTime: string; endTime: string }[]): number {
  return lineup ? slots.filter(slot => isOutsideLineup(lineup.hours, slot)).length : 0;
}

/**
 * Get the CSS modifier of a team-level availability, matching the keys of
 * $team-availability-colors. A day nobody answered for looks like a day the
 * player has not set: the same neutral style.
 */
export function getTeamAvailabilityClass(status: TeamAvailabilityStatus): string {
  return status === 'unknown' ? getAvailabilityClass(null) : `team-availability--${status}`;
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
