// Notifications in the app: how long ago one came, and where it leads

import type { RouteLocationRaw } from 'vue-router';
import type { NotificationTarget } from '@shared/types';
import { formatShortDay, notificationTargetPath } from '@shared/utils';
import { calendarRoute, formatDateStr } from '@/utils/calendar';

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

/** Where a notification leads, as a route of the app: a day of the calendar, the team page, or the home */
export function notificationRoute(target: NotificationTarget): RouteLocationRaw {
  return target.page === 'calendar' ? calendarRoute(target) : { path: notificationTargetPath(target) };
}
