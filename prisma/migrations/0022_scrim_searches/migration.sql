-- Migration: scrim_searches
-- A team puts a run of consecutive slots of a venue (one arena) up for an
-- opponent. The times come from eva.gg at creation, so the search can be
-- shown without asking eva.gg again. A withdrawn search is deleted.

CREATE TYPE "ScrimSearchStatus" AS ENUM ('OPEN', 'MATCHED');

CREATE TABLE "ScrimSearch" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "arenaNumber" INTEGER NOT NULL,
    "evaSlotIds" TEXT[] NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "convocationTime" TEXT NOT NULL,
    "status" "ScrimSearchStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScrimSearch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScrimSearch_venueId_date_idx" ON "ScrimSearch"("venueId", "date");
CREATE INDEX "ScrimSearch_teamId_date_idx" ON "ScrimSearch"("teamId", "date");

ALTER TABLE "ScrimSearch"
  ADD CONSTRAINT "ScrimSearch_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScrimSearch_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScrimSearch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
