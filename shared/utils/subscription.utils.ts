// Subscription utilities - renewal schedule shared by the calendar (server)
// and the profile page (client)

import { SUBSCRIPTION_RENEWAL_PERIOD_DAYS } from '@shared/constants/subscription.constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole-day index of a YYYY-MM-DD date. Counted in UTC so that daylight saving
// changes never add or remove an hour between two dates.
function toDayIndex(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year!, month! - 1, day!) / MS_PER_DAY;
}

function fromDayIndex(dayIndex: number): string {
  return new Date(dayIndex * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Whether `date` is a renewal day of a subscription renewing every
 * SUBSCRIPTION_RENEWAL_PERIOD_DAYS days from `renewalDate` (both YYYY-MM-DD).
 * Days before `renewalDate` are never renewal days.
 */
export function isSubscriptionRenewalDay(renewalDate: string, date: string): boolean {
  const elapsedDays = toDayIndex(date) - toDayIndex(renewalDate);
  return elapsedDays >= 0 && elapsedDays % SUBSCRIPTION_RENEWAL_PERIOD_DAYS === 0;
}

/**
 * First renewal day on or after `fromDate` (both YYYY-MM-DD).
 */
export function getNextSubscriptionRenewal(renewalDate: string, fromDate: string): string {
  const anchor = toDayIndex(renewalDate);
  const from = toDayIndex(fromDate);
  if (from <= anchor) return renewalDate;

  const periodsElapsed = Math.ceil((from - anchor) / SUBSCRIPTION_RENEWAL_PERIOD_DAYS);
  return fromDayIndex(anchor + periodsElapsed * SUBSCRIPTION_RENEWAL_PERIOD_DAYS);
}
