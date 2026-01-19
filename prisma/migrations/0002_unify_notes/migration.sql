-- Unify notes columns into single JSON column
-- Replaces generalNotes (TEXT) + phaseNotes (JSONB) with notes (JSONB)

-- Add new unified notes column
ALTER TABLE "GamePlan" ADD COLUMN "notes" JSONB;

-- Drop old columns
ALTER TABLE "GamePlan" DROP COLUMN IF EXISTS "generalNotes";
ALTER TABLE "GamePlan" DROP COLUMN IF EXISTS "phaseNotes";
