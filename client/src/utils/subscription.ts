// Subscription display helpers

import type { SubscriptionTier } from '@shared/types';

// Keyed by SubscriptionTier: a new tier does not compile until it has a label
export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Argent',
  GOLD: 'Or',
};
