// Validation helper functions

import type { EventType, AvailabilityStatus, SubscriptionTier, PlayerSubscription } from '@shared/types';
import { AVAILABILITY_STATUSES, EVENT_TYPES, SUBSCRIPTION_TIERS } from '@shared/types';
import { ERROR } from '@shared/constants';

/**
 * Validate month format (YYYY-MM)
 */
export function isValidMonth(month: unknown): month is string {
  return typeof month === 'string' && /^\d{4}-\d{2}$/.test(month);
}

/**
 * Validate a YYYY-MM-DD date that exists in the calendar (rejects 2026-02-31)
 */
export function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
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
  return typeof type === 'string' && (EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Validate subscription tier
 */
export function isValidSubscriptionTier(tier: unknown): tier is SubscriptionTier {
  return typeof tier === 'string' && (SUBSCRIPTION_TIERS as readonly string[]).includes(tier);
}

/**
 * Validate a subscription payload: { tier, renewalDate }, where null clears a field
 */
export function parseSubscriptionInput(
  body: unknown,
): { subscription: PlayerSubscription } | { errors: string[] } {
  const { tier, renewalDate } = (body ?? {}) as Record<string, unknown>;

  // Written as one condition so TypeScript narrows both fields in the success branch
  if ((tier === null || isValidSubscriptionTier(tier)) && (renewalDate === null || isValidDate(renewalDate))) {
    return { subscription: { tier, renewalDate } };
  }

  const errors: string[] = [];
  if (tier !== null && !isValidSubscriptionTier(tier)) errors.push(ERROR.subscriptionTierInvalid);
  if (renewalDate !== null && !isValidDate(renewalDate)) errors.push(ERROR.subscriptionRenewalDateInvalid);
  return { errors };
}

/**
 * Validate availability status
 */
export function isValidAvailabilityStatus(status: unknown): status is AvailabilityStatus | null {
  return status === null || (typeof status === 'string' && (AVAILABILITY_STATUSES as readonly string[]).includes(status));
}
