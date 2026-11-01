-- Migration: team_logo_image
-- A team logo is an image uploaded by the leader and kept in the database,
-- not a URL. The former text column was never written by any screen.

ALTER TABLE "Team" DROP COLUMN "logo";

ALTER TABLE "Team"
  ADD COLUMN "logoData" BYTEA,
  ADD COLUMN "logoType" TEXT,
  ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);
