-- Migration: scrim_offered_slots
-- A search offers slots, on any arena and not necessarily back to back; the
-- proposal names the run of the match among them. The arena of a search is
-- only known when every offered slot sits on the same one.

ALTER TABLE "ScrimSearch" ALTER COLUMN "arenaNumber" DROP NOT NULL;

ALTER TABLE "ScrimProposal"
  ADD COLUMN "evaSlotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "arenaNumber" INTEGER,
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT,
  ADD COLUMN "convocationTime" TEXT;

-- Proposals made before this change took the whole search: give them its run
UPDATE "ScrimProposal" p
SET "evaSlotIds" = s."evaSlotIds",
    "arenaNumber" = COALESCE(s."arenaNumber", 1),
    "startTime" = s."startTime",
    "endTime" = s."endTime",
    "convocationTime" = s."convocationTime"
FROM "ScrimSearch" s
WHERE s."id" = p."searchId";

ALTER TABLE "ScrimProposal"
  ALTER COLUMN "evaSlotIds" DROP DEFAULT,
  ALTER COLUMN "arenaNumber" SET NOT NULL,
  ALTER COLUMN "startTime" SET NOT NULL,
  ALTER COLUMN "endTime" SET NOT NULL,
  ALTER COLUMN "convocationTime" SET NOT NULL;
