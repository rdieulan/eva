-- A vague "possible" gives way to hours: a player available to play on part
-- of the day says from when, until when, or both. The "possible" answers
-- already given say no hours: they go back to not set.
DELETE FROM "Availability" WHERE "status" = 'CONDITIONAL';
ALTER TYPE "AvailabilityStatus" RENAME VALUE 'CONDITIONAL' TO 'PARTIAL';

ALTER TABLE "Availability" ADD COLUMN "startTime" TEXT,
ADD COLUMN "endTime" TEXT;
