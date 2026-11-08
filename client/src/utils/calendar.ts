// Calendar utility functions

import type { RouteLocationRaw } from 'vue-router';
import type { CalendarEvent, CalendarTarget, EventType, VoiceMedium } from '@shared/types';

/**
 * A day of the calendar as a route of the app: the calendar reads the day,
 * the mode, the venue to tick and what to open from its query
 */
export function calendarRoute(target: CalendarTarget): RouteLocationRaw {
  const query: Record<string, string> = { date: target.date, mode: target.mode };
  if (target.venueId) query.venue = target.venueId;
  if (target.open) query[target.open.kind === 'scrimSearch' ? 'search' : 'event'] = target.open.id;
  return { path: '/calendar', query };
}

/**
 * Get the Monday of the week for a given date
 * @param date - The reference date
 * @returns The Monday of that week
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface EventTypeDisplay {
  label: string;
  emoji: string; // In the form, where the type is picked
  icon: string;  // Name of the SvgIcon in the calendar, in the colour of the type
}

// Keyed by EventType: a new event type does not compile until it says how it is displayed.
// Colours live alongside in $event-type-colors (styles/_variables.scss).
const EVENT_TYPE_DISPLAY: Record<EventType, EventTypeDisplay> = {
  MATCH: { label: 'Match', emoji: '🎮', icon: 'sword' },
  EVENT: { label: 'Événement', emoji: '📅', icon: 'flag' },
  VOICE_MEETING: { label: 'Réunion vocale', emoji: '🎧', icon: 'headset' },
};

// Keyed by VoiceMedium: a new platform does not compile until it says how it is written.
const VOICE_MEDIUM_LABELS: Record<VoiceMedium, string> = {
  DISCORD: 'Discord',
  TEAMSPEAK: 'TeamSpeak',
  MUMBLE: 'Mumble',
  WHATSAPP: 'WhatsApp',
  MESSENGER: 'Messenger',
  TELEGRAM: 'Telegram',
  GOOGLE_MEET: 'Google Meet',
  OTHER: 'Autre',
};

/**
 * Get the name of the platform a voice meeting is held on
 * @param medium - The platform
 * @returns e.g. "Google Meet"
 */
export function getVoiceMediumLabel(medium: VoiceMedium): string {
  return VOICE_MEDIUM_LABELS[medium];
}

/**
 * Get the emoji, icon and French label of an event type
 * @param type - The event type
 * @returns e.g. { emoji: '🎮', icon: 'sword', label: 'Match' }
 */
export function getEventTypeDisplay(type: EventType): EventTypeDisplay {
  return EVENT_TYPE_DISPLAY[type];
}

/**
 * Get the name of the icon of an event type, for SvgIcon
 * @param type - The event type
 * @returns e.g. "sword"
 */
export function getEventTypeIcon(type: EventType): string {
  return EVENT_TYPE_DISPLAY[type].icon;
}

/**
 * Get the French label of an event type prefixed with its emoji
 * @param type - The event type
 * @returns e.g. "🎮 Match"
 */
export function getEventTypeTitle(type: EventType): string {
  const { emoji, label } = EVENT_TYPE_DISPLAY[type];
  return `${emoji} ${label}`;
}

/**
 * Get CSS class for an event type
 * @param type - The event type
 * @returns The CSS modifier class, matching the keys of $event-type-colors
 */
export function getEventTypeClass(type: EventType): string {
  return `event-type--${type.toLowerCase().replace(/_/g, '-')}`;
}

/**
 * The events of a day in the order they happen, a new array
 * @param events - The events, in any order
 * @returns The events by start time
 */
export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Format a date to ISO date string (YYYY-MM-DD)
 * @param date - The date to format
 * @returns The ISO date string
 */
export function formatDateToISO(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/**
 * Format a date to YYYY-MM-DD string (local timezone)
 * Unlike formatDateToISO, this uses local timezone to avoid date shifts
 * @param date - The date to format
 * @returns The formatted date string
 */
export function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a YYYY-MM-DD date as a long French date, e.g. "mercredi 28 octobre 2026".
 * Built from the date parts in local time, so the day never shifts with the timezone.
 * @param dateStr - The date string (YYYY-MM-DD)
 * @returns The formatted date
 */
export function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Check if a date string is in the past (before today)
 * @param dateStr - The date string (YYYY-MM-DD) to check
 * @returns True if the date is before today
 */
export function isPastDateStr(dateStr: string): boolean {
  const today = formatDateStr(new Date());
  return dateStr < today;
}

/**
 * Check if a date is in the past (before today)
 * @param date - The date to check
 * @returns True if the date is before today
 */
export function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
}

