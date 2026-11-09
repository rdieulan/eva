-- The first-login walk-through (pseudo, eva.gg account, EVA Pass, team) shows
-- once: the account keeps when it was done or skipped. The accounts made
-- before it existed skip it.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP;
