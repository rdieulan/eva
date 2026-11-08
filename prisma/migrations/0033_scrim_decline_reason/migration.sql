-- Why a proposal was declined, kept with it: by the team that searches, or by
-- the app once the proposal no longer held. The sheet of a search says it in
-- the words of the notification the proposing team received.
CREATE TYPE "ScrimDeclineReason" AS ENUM ('BY_TEAM', 'TIME_TAKEN', 'SEARCH_FILLED', 'SEARCH_CLOSED', 'RUN_TAKEN', 'SEARCH_CHANGED', 'SEARCH_WITHDRAWN', 'DAY_PASSED');

ALTER TABLE "ScrimProposal" ADD COLUMN "declineReason" "ScrimDeclineReason";

-- A declined proposal says why, no other does. A proposal declined before the
-- reasons were kept stops the migration rather than get a reason made up.
ALTER TABLE "ScrimProposal" ADD CONSTRAINT "ScrimProposal_declineReason_check"
  CHECK (("status" = 'DECLINED') = ("declineReason" IS NOT NULL));

-- The notifications already told name their reason as the proposal keeps it
-- now. A search that closed on a pending proposal at another time had all its
-- matches: its slots left always held that proposal's run.
UPDATE "Notification"
SET "data" = jsonb_set("data", '{reason}', to_jsonb(CASE "data"->>'reason'
  WHEN 'byTeam' THEN 'BY_TEAM'
  WHEN 'timeTaken' THEN 'TIME_TAKEN'
  WHEN 'searchClosed' THEN 'SEARCH_FILLED'
  WHEN 'runTaken' THEN 'RUN_TAKEN'
  WHEN 'searchChanged' THEN 'SEARCH_CHANGED'
  ELSE "data"->>'reason'
END))
WHERE "kind" = 'SCRIM_PROPOSAL_DECLINED';
