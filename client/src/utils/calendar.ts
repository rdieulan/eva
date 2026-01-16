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

/**
 * Get a human-readable label for an event type
 * @param type - The event type
 * @returns The label in French
 */
export function getEventTypeLabel(type: EventType | string): string {
  switch (type) {
    case 'MATCH': return 'Match';
    case 'EVENT': return 'Événement';
    default: return type;
  }
}

/**
 * Get CSS class for an event type
 * @param type - The event type
 * @returns The CSS class name
 */
export function getEventTypeClass(type: EventType | string): string {
  switch (type) {
    case 'MATCH': return 'event-match';
    case 'EVENT': return 'event-event';
    default: return '';
  }
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

