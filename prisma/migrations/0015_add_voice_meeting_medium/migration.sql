-- Migration: add_voice_meeting_medium
-- A strategy session is not tied to Discord: the event type becomes VOICE_MEETING
-- and the platform it is held on moves to its own field. Sessions already created
-- keep Discord as their platform.

CREATE TYPE "VoiceMedium" AS ENUM ('DISCORD', 'TEAMSPEAK', 'MUMBLE', 'WHATSAPP', 'MESSENGER', 'TELEGRAM', 'GOOGLE_MEET', 'OTHER');

ALTER TABLE "CalendarEvent" ADD COLUMN "voiceMedium" "VoiceMedium";

UPDATE "CalendarEvent" SET "voiceMedium" = 'DISCORD' WHERE "type" = 'DISCORD';

-- Postgres cannot drop a value from an enum, so EventType is rebuilt without DISCORD
CREATE TYPE "EventType_new" AS ENUM ('MATCH', 'EVENT', 'VOICE_MEETING');

ALTER TABLE "CalendarEvent"
  ALTER COLUMN "type" TYPE "EventType_new"
  USING (CASE WHEN "type"::text = 'DISCORD' THEN 'VOICE_MEETING' ELSE "type"::text END)::"EventType_new";

DROP TYPE "EventType";

ALTER TYPE "EventType_new" RENAME TO "EventType";
