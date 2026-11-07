-- Migration: scrim_multi_venue
-- A search becomes a team's offer for a day across one venue or more: each
-- offered slot is a row with its venue, arena and times, and a proposal names
-- the venue its run is played in. The searches opened before kept their slots
-- as bare ids, with no time of their own, so they cannot be read the new way:
-- they go, with their proposals; the matches they made stay in the calendars.

DELETE FROM "ScrimSearch";

-- DropForeignKey
ALTER TABLE "ScrimSearch" DROP CONSTRAINT "ScrimSearch_venueId_fkey";

-- DropIndex
DROP INDEX "ScrimSearch_venueId_date_idx";

-- AlterTable
ALTER TABLE "ScrimProposal" ADD COLUMN     "venueId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ScrimSearch" DROP COLUMN "arenaNumber",
DROP COLUMN "evaSlotIds",
DROP COLUMN "runStarts",
DROP COLUMN "venueId";

-- CreateTable
CREATE TABLE "ScrimSearchSlot" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "evaSlotId" TEXT NOT NULL,
    "arenaNumber" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "convocationTime" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ScrimSearchSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrimSearchSlot_venueId_idx" ON "ScrimSearchSlot"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrimSearchSlot_searchId_evaSlotId_key" ON "ScrimSearchSlot"("searchId", "evaSlotId");

-- CreateIndex
CREATE INDEX "ScrimProposal_venueId_idx" ON "ScrimProposal"("venueId");

-- AddForeignKey
ALTER TABLE "ScrimSearchSlot" ADD CONSTRAINT "ScrimSearchSlot_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "ScrimSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimSearchSlot" ADD CONSTRAINT "ScrimSearchSlot_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimProposal" ADD CONSTRAINT "ScrimProposal_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
