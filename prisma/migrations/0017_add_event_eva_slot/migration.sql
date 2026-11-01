-- Migration: add_event_eva_slot
-- A match can be placed on one of the slots eva.gg lists for its venue that
-- day. We keep eva.gg's slot id: bookings carry the same one, which is what
-- will let us check which linked players booked the match.

ALTER TABLE "CalendarEvent" ADD COLUMN "evaSlotId" TEXT;
