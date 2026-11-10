-- How many days ahead, today included, a team's players are asked for their
-- availability: 15 to start with, set by whoever manages the team.
ALTER TABLE "Team" ADD COLUMN "availabilityHorizonDays" INTEGER NOT NULL DEFAULT 15;
