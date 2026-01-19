-- Fix gamePlan JSON keys case sensitivity
-- Problem: Old data has "visibleplayerId" and "visibleplayerName" (lowercase 'player')
-- Expected: "visiblePlayerId" and "visiblePlayerName" (camelCase)

-- Update all CalendarEvent records that have gamePlan with incorrect keys
UPDATE "CalendarEvent"
SET "gamePlan" = REPLACE(
  REPLACE(
    "gamePlan"::text,
    '"visibleplayerId"',
    '"visiblePlayerId"'
  ),
  '"visibleplayerName"',
  '"visiblePlayerName"'
)::jsonb
WHERE "gamePlan" IS NOT NULL
  AND "gamePlan"::text LIKE '%visibleplayerId%';
