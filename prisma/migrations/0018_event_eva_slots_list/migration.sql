-- Migration: event_eva_slots_list
-- A match usually runs on two consecutive slots, so the event keeps the list
-- of its slots, in order, rather than a single one.

ALTER TABLE "CalendarEvent" ADD COLUMN "evaSlotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "CalendarEvent" SET "evaSlotIds" = ARRAY["evaSlotId"] WHERE "evaSlotId" IS NOT NULL;

ALTER TABLE "CalendarEvent" DROP COLUMN "evaSlotId";
