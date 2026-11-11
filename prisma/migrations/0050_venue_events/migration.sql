-- The events a venue publishes in its calendar, open to all and offered to no
-- team; a team's copy of one it added, gone with it, once per team; and what
-- the team is told when the venue withdraws one it added
-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'VENUE_EVENT_WITHDRAWN';

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "venueEventId" TEXT;

-- CreateTable
CREATE TABLE "VenueEvent" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueEvent_venueId_date_idx" ON "VenueEvent"("venueId", "date");

-- CreateIndex
CREATE INDEX "CalendarEvent_venueEventId_idx" ON "CalendarEvent"("venueEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_teamId_venueEventId_key" ON "CalendarEvent"("teamId", "venueEventId");

-- AddForeignKey
ALTER TABLE "VenueEvent" ADD CONSTRAINT "VenueEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_venueEventId_fkey" FOREIGN KEY ("venueEventId") REFERENCES "VenueEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
