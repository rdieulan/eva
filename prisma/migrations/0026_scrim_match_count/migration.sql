-- Migration: scrim_match_count
-- A search says how many matches the team wants to play that day, one by
-- default, and keeps where each streak of consecutive offered slots starts,
-- so it can tell whether its untaken slots still hold a match without asking
-- eva.gg again.

ALTER TABLE "ScrimSearch" ADD COLUMN "matchCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ScrimSearch" ADD COLUMN "runStarts" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
