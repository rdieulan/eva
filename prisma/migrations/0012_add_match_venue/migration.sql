-- Migration: add_match_venue
-- A match is played in a venue. Deleting a venue leaves its matches in place
-- without one, the same way it leaves affiliated teams without one.

ALTER TABLE "CalendarEvent" ADD COLUMN "venueId" TEXT;

CREATE INDEX "CalendarEvent_venueId_idx" ON "CalendarEvent"("venueId");

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
