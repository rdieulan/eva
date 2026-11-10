// Links into competitive.eva.gg, the site of eva.gg's leagues, and the end of
// its registrations as a player reads it

import { COMPETITIVE_SITE_URL } from '@shared/constants/league.constants';
import { formatShortDay } from '@shared/utils/date.utils';

/** The page where a team registers to a tournament of the leagues */
export function competitiveRegistrationUrl(tournamentId: string): string {
  return `${COMPETITIVE_SITE_URL}/tournaments/${encodeURIComponent(tournamentId)}/registration`;
}

// A moment as its day (YYYY-MM-DD) and its time (HH:mm) in Paris
function inParis(instant: Date): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(candidate => candidate.type === type)!.value;
  return { day: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

// The day before a day, both YYYY-MM-DD
function dayBefore(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, date! - 1)).toISOString().slice(0, 10);
}

/**
 * The last moment to register, in Paris time, as a player reads it: closing at
 * midnight leaves the day before as the last one, "jusqu'au dim. 29/11";
 * closing at another hour says it, "jusqu'au lun. 30/11 à 18:00".
 */
export function formatRegistrationDeadline(closesAt: string): string {
  const { day, time } = inParis(new Date(closesAt));
  return time === '00:00' ? `jusqu'au ${formatShortDay(dayBefore(day))}` : `jusqu'au ${formatShortDay(day)} à ${time}`;
}
