-- Migration: scrim_proposals
-- A team answers another team's search with a proposal. Accepting one closes
-- the search, declines the other pending proposals and creates the match in
-- both calendars; the two events keep a pointer to the search they came from.

CREATE TYPE "ScrimProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "ScrimProposal" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "message" TEXT,
    "status" "ScrimProposalStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScrimProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScrimProposal_searchId_idx" ON "ScrimProposal"("searchId");
CREATE INDEX "ScrimProposal_teamId_idx" ON "ScrimProposal"("teamId");

ALTER TABLE "ScrimProposal"
  ADD CONSTRAINT "ScrimProposal_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "ScrimSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScrimProposal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScrimProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent" ADD COLUMN "scrimSearchId" TEXT;

CREATE INDEX "CalendarEvent_scrimSearchId_idx" ON "CalendarEvent"("scrimSearchId");

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_scrimSearchId_fkey" FOREIGN KEY ("scrimSearchId") REFERENCES "ScrimSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
