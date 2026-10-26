-- Migration: add_voice_only_availability
-- Adds an availability status for players who can join voice chat but not play.

ALTER TYPE "AvailabilityStatus" ADD VALUE 'VOICE_ONLY';
