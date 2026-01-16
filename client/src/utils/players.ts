// Player utility functions

import type { AvailabilityStatus } from '@shared/types';

/**
 * Get initials from a player name
 * @param name - The player name
 * @returns The initials (first letter of each word, max 2)
 */
export function getPlayerInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get CSS class for a player availability status
 * @param status - The availability status
 * @returns The CSS class name
 */
export function getPlayerStatusClass(status: AvailabilityStatus | null): string {
  switch (status) {
    case 'AVAILABLE': return 'status-available';
    case 'CONDITIONAL': return 'status-maybe';
    case 'UNAVAILABLE': return 'status-unavailable';
    default: return 'status-unknown';
  }
}

/**
 * Get the next availability status in the cycle
 * @param current - The current status
 * @returns The next status in the cycle
 */
export function getNextAvailabilityStatus(current: AvailabilityStatus | null): AvailabilityStatus {
  switch (current) {
    case null: return 'AVAILABLE';
    case 'AVAILABLE': return 'CONDITIONAL';
    case 'CONDITIONAL': return 'UNAVAILABLE';
    case 'UNAVAILABLE': return 'AVAILABLE';
    default: return 'AVAILABLE';
  }
}

