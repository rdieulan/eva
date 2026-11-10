-- The divisions of a venue's local league, as its manager arranges them: how many,
-- and where each league team plays. And the venue each month of a league is played at.
-- AlterTable
ALTER TABLE "LeagueTournament" ADD COLUMN     "venueId" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "leagueDivisionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LeagueDivisionPlace" (
    "leagueTeamId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "division" INTEGER,
    "position" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueDivisionPlace_pkey" PRIMARY KEY ("leagueTeamId")
);

-- CreateIndex
CREATE INDEX "LeagueDivisionPlace_venueId_idx" ON "LeagueDivisionPlace"("venueId");

-- CreateIndex
CREATE INDEX "LeagueTournament_venueId_idx" ON "LeagueTournament"("venueId");

-- AddForeignKey
ALTER TABLE "LeagueDivisionPlace" ADD CONSTRAINT "LeagueDivisionPlace_leagueTeamId_fkey" FOREIGN KEY ("leagueTeamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueDivisionPlace" ADD CONSTRAINT "LeagueDivisionPlace_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTournament" ADD CONSTRAINT "LeagueTournament_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

