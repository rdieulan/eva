// Availability of a team as a whole, from the availabilities of its players

import { TEAM_PLAYER_COUNT } from '@shared/constants/eva.constants';
import type { AvailabilityStatus } from '@shared/types/calendar.types';

/**
 * What can the team do on a day, for sure, from the answers given so far?
 * - ready: play, with a full lineup of players marked available
 * - shaky: play, but the lineup counts players available under conditions
 * - voice: no lineup in the arena yet, but a full table on voice chat
 * - short: nothing, even if every player who has not answered said yes
 * - unknown: nothing yet, and the players who have not answered could still change that
 */
export type TeamAvailabilityStatus = 'ready' | 'shaky' | 'voice' | 'short' | 'unknown';

export interface TeamAvailability {
  status: TeamAvailabilityStatus;
  available: number;   // Players marked available
  conditional: number; // Players available under conditions
  voice: number;       // Players on voice chat only
  pending: number;     // Players who have not answered yet
}

/**
 * Assess what a team can do from its players' statuses for a day. The verdict
 * is the floor the answers already guarantee: a day with four answers says
 * something, even if the silent players could still lift it. Players in the
 * arena can also join voice chat, so a voice table counts them too. An
 * unavailable player is out of everything. A player who has not answered is
 * neither in nor out: silence is not a no, so a day with nothing guaranteed
 * stays open as long as the silent players could still fill a table.
 */
export function assessTeamAvailability(statuses: Array<AvailabilityStatus | null>): TeamAvailability {
  let available = 0;
  let conditional = 0;
  let voice = 0;
  let pending = 0;
  for (const status of statuses) {
    if (status === null) pending++;
    else if (status === 'AVAILABLE') available++;
    else if (status === 'CONDITIONAL') conditional++;
    else if (status === 'VOICE_ONLY') voice++;
  }

  const arena = available + conditional;
  let status: TeamAvailabilityStatus;
  if (available >= TEAM_PLAYER_COUNT) status = 'ready';
  else if (arena >= TEAM_PLAYER_COUNT) status = 'shaky';
  else if (arena + voice >= TEAM_PLAYER_COUNT) status = 'voice';
  else if (arena + voice + pending >= TEAM_PLAYER_COUNT) status = 'unknown';
  else status = 'short';

  return { status, available, conditional, voice, pending };
}
