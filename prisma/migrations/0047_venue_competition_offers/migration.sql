-- What each team says of a competition its venue published for it, and the
-- team's event once it accepted it, gone with the venue's competition
-- CreateEnum
CREATE TYPE "VenueCompetitionOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "venueCompetitionId" TEXT;

-- CreateTable
CREATE TABLE "VenueCompetitionOffer" (
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "VenueCompetitionOfferStatus" NOT NULL DEFAULT 'PENDING',
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueCompetitionOffer_pkey" PRIMARY KEY ("competitionId","teamId")
);

-- CreateIndex
CREATE INDEX "VenueCompetitionOffer_teamId_status_idx" ON "VenueCompetitionOffer"("teamId", "status");

-- CreateIndex
CREATE INDEX "CalendarEvent_venueCompetitionId_idx" ON "CalendarEvent"("venueCompetitionId");

-- AddForeignKey
ALTER TABLE "VenueCompetitionOffer" ADD CONSTRAINT "VenueCompetitionOffer_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "VenueCompetition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueCompetitionOffer" ADD CONSTRAINT "VenueCompetitionOffer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_venueCompetitionId_fkey" FOREIGN KEY ("venueCompetitionId") REFERENCES "VenueCompetition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

