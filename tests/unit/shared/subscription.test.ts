import { describe, it, expect } from 'vitest';
import { isSubscriptionRenewalDay, getNextSubscriptionRenewal } from '@shared/utils';
import { SUBSCRIPTION_RENEWAL_PERIOD_DAYS } from '@shared/constants';

describe('isSubscriptionRenewalDay', () => {
  it('renews on the entered date and every period after it', () => {
    expect(isSubscriptionRenewalDay('2026-10-05', '2026-10-05')).toBe(true);
    expect(isSubscriptionRenewalDay('2026-10-05', '2026-11-04')).toBe(true);
    expect(isSubscriptionRenewalDay('2026-10-05', '2026-12-04')).toBe(true);
  });

  it('does not renew on other days', () => {
    expect(isSubscriptionRenewalDay('2026-10-05', '2026-11-03')).toBe(false);
    expect(isSubscriptionRenewalDay('2026-10-05', '2026-11-05')).toBe(false);
    expect(isSubscriptionRenewalDay('2026-10-05', '2026-10-06')).toBe(false);
  });

  it('never renews before the entered date', () => {
    expect(isSubscriptionRenewalDay('2026-10-05', '2026-09-05')).toBe(false);
    expect(isSubscriptionRenewalDay('2026-10-05', '2026-09-04')).toBe(false);
  });

  it('counts whole days across daylight saving changes and year ends', () => {
    // Europe switches to winter time on 2026-10-25: still exactly one period later
    expect(isSubscriptionRenewalDay('2026-10-01', '2026-10-31')).toBe(true);
    expect(isSubscriptionRenewalDay('2026-12-15', '2027-01-14')).toBe(true);
    // Leap year: 2028-02-01 + 30 days is 2028-03-02
    expect(isSubscriptionRenewalDay('2028-02-01', '2028-03-02')).toBe(true);
  });

  it('follows the configured period', () => {
    expect(SUBSCRIPTION_RENEWAL_PERIOD_DAYS).toBe(30);
  });
});

describe('getNextSubscriptionRenewal', () => {
  it('returns the entered date while it is still ahead', () => {
    expect(getNextSubscriptionRenewal('2026-11-10', '2026-10-26')).toBe('2026-11-10');
    expect(getNextSubscriptionRenewal('2026-10-26', '2026-10-26')).toBe('2026-10-26');
  });

  it('returns today when today is a renewal day', () => {
    expect(getNextSubscriptionRenewal('2026-09-26', '2026-10-26')).toBe('2026-10-26');
  });

  it('returns the first renewal after today otherwise', () => {
    expect(getNextSubscriptionRenewal('2026-09-20', '2026-10-26')).toBe('2026-11-19');
    expect(getNextSubscriptionRenewal('2026-01-01', '2026-12-31')).toBe('2027-01-26');
  });
});
