-- Migration: add_venue_external_id
-- Venues filled from the eva.gg API carry their location id there, so the sync
-- can be run again without duplicating them. Venues created by hand have none.

ALTER TABLE "Venue" ADD COLUMN "externalId" INTEGER;

CREATE UNIQUE INDEX "Venue_externalId_key" ON "Venue"("externalId");
