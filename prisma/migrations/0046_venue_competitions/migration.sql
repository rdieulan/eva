-- The competitions a venue's manager publishes: days of a division of its
-- local league, and events of the venue's own
-- CreateTable
CREATE TABLE "VenueCompetition" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "division" INTEGER,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueCompetition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueCompetition_venueId_date_idx" ON "VenueCompetition"("venueId", "date");

-- AddForeignKey
ALTER TABLE "VenueCompetition" ADD CONSTRAINT "VenueCompetition_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

