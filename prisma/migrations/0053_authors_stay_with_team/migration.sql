-- What a player made for their team, its events, searches and proposals,
-- stays with the team when the player is deleted: only the author goes
-- DropForeignKey
ALTER TABLE "CalendarEvent" DROP CONSTRAINT "CalendarEvent_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ScrimProposal" DROP CONSTRAINT "ScrimProposal_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ScrimSearch" DROP CONSTRAINT "ScrimSearch_createdById_fkey";

-- AlterTable
ALTER TABLE "CalendarEvent" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ScrimProposal" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ScrimSearch" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimSearch" ADD CONSTRAINT "ScrimSearch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimProposal" ADD CONSTRAINT "ScrimProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
