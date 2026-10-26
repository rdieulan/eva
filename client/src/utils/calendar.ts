// Calendar utility functions

import type { EventType } from '@shared/types';

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
  icon: string;
}

// Keyed by EventType: a new event type does not compile until it says how it is displayed.
// Colours live alongside in $event-type-colors (styles/_variables.scss).
const EVENT_TYPE_DISPLAY: Record<EventType, EventTypeDisplay> = {
  MATCH: { label: 'Match', icon: '🎮' },
  EVENT: { label: 'Événement', icon: '📅' },
  DISCORD: { label: 'Discord', icon: '🎧' },
};

/**
 * Get the icon and French label of an event type
 * @param type - The event type
 * @returns e.g. { icon: '🎮', label: 'Match' }
 */
export function getEventTypeDisplay(type: EventType): EventTypeDisplay {
  return EVENT_TYPE_DISPLAY[type];
}

/**
 * Get the French label of an event type prefixed with its icon
 * @param type - The event type
 * @returns e.g. "🎮 Match"
 */
export function getEventTypeTitle(type: EventType): string {
  const { icon, label } = EVENT_TYPE_DISPLAY[type];
  return `${icon} ${label}`;
}

/**
 * Get CSS class for an event type
 * @param type - The event type
 * @returns The CSS modifier class, matching the keys of $event-type-colors
 */
export function getEventTypeClass(type: EventType): string {
  return `event-type--${type.toLowerCase()}`;
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

