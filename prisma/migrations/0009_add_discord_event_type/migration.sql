-- Migration: add_discord_event_type
-- Adds a calendar event type for strategy sessions held on Discord.

ALTER TYPE "EventType" ADD VALUE 'DISCORD';
