-- Migration: scrim_match_length
-- A search says how long the match it looks for is, in slots: the offer says
-- when the team can play, this says how much. Two slots by default, a scrim.

ALTER TABLE "ScrimSearch" ADD COLUMN "slotCount" INTEGER NOT NULL DEFAULT 2;
