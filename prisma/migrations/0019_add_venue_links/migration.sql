-- Migration: add_venue_links
-- Where a venue can be reached online: its website and the networks eva.gg
-- publishes for its locations. Filled by the venue sync, or by hand in the
-- admin for venues eva.gg does not list.

ALTER TABLE "Venue"
  ADD COLUMN "website" TEXT,
  ADD COLUMN "discord" TEXT,
  ADD COLUMN "facebook" TEXT,
  ADD COLUMN "instagram" TEXT,
  ADD COLUMN "x" TEXT,
  ADD COLUMN "tiktok" TEXT,
  ADD COLUMN "youtube" TEXT,
  ADD COLUMN "twitch" TEXT;
