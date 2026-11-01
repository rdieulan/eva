-- Migration: team_favorite_venues
-- The venues a team plays at most often, kept in the order the team listed
-- them. Distinct from the affiliated venue (Team.venueId).

CREATE TABLE "TeamFavoriteVenue" (
    "teamId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "TeamFavoriteVenue_pkey" PRIMARY KEY ("teamId", "venueId")
);

CREATE INDEX "TeamFavoriteVenue_venueId_idx" ON "TeamFavoriteVenue"("venueId");

ALTER TABLE "TeamFavoriteVenue"
  ADD CONSTRAINT "TeamFavoriteVenue_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TeamFavoriteVenue_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
