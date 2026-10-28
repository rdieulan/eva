-- Migration: add_venue_arenas
-- A venue runs one or more arenas for the competitive game, numbered 1 upwards,
-- and a match can say which one it is played on.

ALTER TABLE "Venue" ADD COLUMN "arenaCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "CalendarEvent" ADD COLUMN "arenaNumber" INTEGER;
