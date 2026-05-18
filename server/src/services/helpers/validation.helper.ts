// Validation helper functions

import type { EventType, AvailabilityStatus } from '@shared/types';

/**
 * Validate month format (YYYY-MM)
 */
export function isValidMonth(month: unknown): month is string {
  return typeof month === 'string' && /^\d{4}-\d{2}$/.test(month);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Validate time format (HH:mm)
 */
export function isValidTime(time: unknown): time is string {
  return typeof time === 'string' && /^\d{2}:\d{2}$/.test(time);
}

/**
 * Validate event type
 */
export function isValidEventType(type: unknown): type is EventType {
  return type === 'MATCH' || type === 'EVENT';
}

/**
 * Validate availability status
 */
export function isValidAvailabilityStatus(status: unknown): status is AvailabilityStatus | null {
  return status === null || status === 'AVAILABLE' || status === 'CONDITIONAL' || status === 'UNAVAILABLE';
}
