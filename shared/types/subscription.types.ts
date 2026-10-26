// Player subscription types

/**
 * Subscription tiers — single source of truth for validation and the profile
 * form. Mirrors the SubscriptionTier enum in prisma/schema.prisma.
 */
export const SUBSCRIPTION_TIERS = ['BRONZE', 'SILVER', 'GOLD'] as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

// A player's subscription, as entered in their profile
export interface PlayerSubscription {
  tier: SubscriptionTier | null;
  renewalDate: string | null; // YYYY-MM-DD, renews every SUBSCRIPTION_RENEWAL_PERIOD_DAYS from this date
}

// A player whose subscription renews on a given calendar day
export interface SubscriptionRenewal {
  playerId: string;
  playerName: string;
  tier: SubscriptionTier | null;
}
