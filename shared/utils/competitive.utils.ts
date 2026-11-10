// Links into competitive.eva.gg, the site of eva.gg's leagues, and the end of
// its registrations as a player reads it

import { COMPETITIVE_SITE_URL } from '@shared/constants/league.constants';
import { formatShortDay, shiftDay, toParisTime } from '@shared/utils/date.utils';

/** The page where a team registers to a tournament of the leagues */
export function competitiveRegistrationUrl(tournamentId: string): string {
  return `${COMPETITIVE_SITE_URL}/tournaments/${encodeURIComponent(tournamentId)}/registration`;
}

/**
 * The last moment to register, in Paris time, as a player reads it: closing at
 * midnight leaves the day before as the last one, "jusqu'au dim. 29/11";
 * closing at another hour says it, "jusqu'au lun. 30/11 à 18:00".
 */
export function formatRegistrationDeadline(closesAt: string): string {
  const { day, time } = toParisTime(new Date(closesAt));
  return time === '00:00' ? `jusqu'au ${formatShortDay(shiftDay(day, -1))}` : `jusqu'au ${formatShortDay(day)} à ${time}`;
}
