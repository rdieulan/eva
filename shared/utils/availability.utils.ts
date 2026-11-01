// Availability of a team as a whole, from the availabilities of its players

import { TEAM_PLAYER_COUNT } from '@shared/constants/eva.constants';
import type { AvailabilityStatus } from '@shared/types/calendar.types';

/**
 * Can the team line up on a day?
 * - ready: at least a full lineup of players marked available
 * - shaky: a full lineup only by counting the players available under conditions
 * - short: not enough players, whatever the conditions
 * - unknown: nobody has said anything yet, which is not the same as a no
 */
export type TeamAvailabilityStatus = 'ready' | 'shaky' | 'short' | 'unknown';

export interface TeamAvailability {
  status: TeamAvailabilityStatus;
  available: number;   // Players marked available
  conditional: number; // Players available under conditions
  answered: number;    // Players who set any status
}

/**
 * Assess whether a team can field a lineup from its players' statuses for a
 * day. Voice-only, unavailable and unset players do not count: none of them
 * will be in the arena.
 */
export function assessTeamAvailability(statuses: Array<AvailabilityStatus | null>): TeamAvailability {
  let available = 0;
  let conditional = 0;
  let answered = 0;
  for (const status of statuses) {
    if (status !== null) answered++;
    if (status === 'AVAILABLE') available++;
    else if (status === 'CONDITIONAL') conditional++;
  }

  let status: TeamAvailabilityStatus;
  if (available >= TEAM_PLAYER_COUNT) status = 'ready';
  else if (available + conditional >= TEAM_PLAYER_COUNT) status = 'shaky';
  else if (answered === 0) status = 'unknown';
  else status = 'short';

  return { status, available, conditional, answered };
}
