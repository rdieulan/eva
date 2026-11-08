// Notifications in the app: how long ago one came (where it leads: calendarRoute)

import { formatShortDay } from '@shared/utils';
import { formatDateStr } from '@/utils/calendar';

const MINUTE_MS = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

/**
 * How long ago something came, in a few words: minutes, hours, days, then the
 * day itself past a week
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / MINUTE_MS);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < MINUTES_PER_HOUR) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `il y a ${hours} h`;
  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days === 1) return 'hier';
  if (days < DAYS_PER_WEEK) return `il y a ${days} jours`;
  return `le ${formatShortDay(formatDateStr(new Date(iso)))}`;
}
