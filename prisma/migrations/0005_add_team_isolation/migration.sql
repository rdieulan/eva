-- Add teamId to GamePlan for team isolation
ALTER TABLE "GamePlan" ADD COLUMN "teamId" TEXT;

-- Add teamId to CalendarEvent for team isolation
ALTER TABLE "CalendarEvent" ADD COLUMN "teamId" TEXT;

-- Create indexes for efficient team filtering
CREATE INDEX "GamePlan_teamId_idx" ON "GamePlan"("teamId");
CREATE INDEX "CalendarEvent_teamId_idx" ON "CalendarEvent"("teamId");

-- Add foreign key constraints
ALTER TABLE "GamePlan" ADD CONSTRAINT "GamePlan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migration script: Associate existing data with teams
-- GamePlans: Get team from players' users
UPDATE "GamePlan" gp
SET "teamId" = (
    SELECT u."teamId"
    FROM "GamePlanPlayer" gpp
    JOIN "User" u ON gpp."userId" = u."id"
    WHERE gpp."gamePlanId" = gp."id" AND u."teamId" IS NOT NULL
    LIMIT 1
)
WHERE gp."teamId" IS NULL;

-- CalendarEvents: Get team from creator
UPDATE "CalendarEvent" ce
SET "teamId" = (
    SELECT u."teamId"
    FROM "User" u
    WHERE u."id" = ce."createdById"
)
WHERE ce."teamId" IS NULL;
