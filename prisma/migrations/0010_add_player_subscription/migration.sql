-- Migration: add_player_subscription
-- Players record their subscription tier and a renewal date; the subscription
-- renews every 30 days from that date.

CREATE TYPE "SubscriptionTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');

ALTER TABLE "Player"
  ADD COLUMN "subscriptionTier" "SubscriptionTier",
  ADD COLUMN "subscriptionRenewalDate" DATE;
