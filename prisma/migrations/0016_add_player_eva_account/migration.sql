-- Migration: add_player_eva_account
-- A player links their eva.gg account from their profile. We keep the eva.gg
-- user id, which survives renames there, plus the tag they entered at the
-- time, for display. One eva.gg account can be linked to a single player.

ALTER TABLE "Player"
  ADD COLUMN "evaUserId" INTEGER,
  ADD COLUMN "evaUsername" TEXT,
  ADD COLUMN "evaLinkedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Player_evaUserId_key" ON "Player"("evaUserId");
