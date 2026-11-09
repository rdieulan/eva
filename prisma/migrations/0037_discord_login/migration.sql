-- People sign in with their Discord account: one person, one account, no email
-- and no password. Everyone is a player; managing a venue and administering
-- the app are roles on top, and a session acts as one of them.

CREATE TYPE "AccountRole" AS ENUM ('PLAYER', 'MANAGER', 'ADMIN');

-- Every account is a player: the accounts made for a manager or an admin get one
INSERT INTO "Player" ("id", "createdAt", "updatedAt")
SELECT 'player-' || "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "User" WHERE "playerId" IS NULL;
UPDATE "User" SET "playerId" = 'player-' || "id" WHERE "playerId" IS NULL;

ALTER TABLE "User" DROP CONSTRAINT "User_playerId_fkey";
ALTER TABLE "User" ALTER COLUMN "playerId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The Discord account a person signs in with. The accounts made before have
-- none: they get a mark no Discord account can carry (Discord's are digits
-- only), and stay reachable through the development login alone.
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
UPDATE "User" SET "discordId" = 'none-' || "id";
ALTER TABLE "User" ALTER COLUMN "discordId" SET NOT NULL;
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- No more email, password, reset link or linked accounts
DROP INDEX "User_email_key";
DROP INDEX "User_passwordResetToken_key";
ALTER TABLE "User" DROP CONSTRAINT "User_linkedAccountGroupId_fkey";
DROP INDEX "User_linkedAccountGroupId_idx";
ALTER TABLE "User"
    DROP COLUMN "email",
    DROP COLUMN "password",
    DROP COLUMN "passwordResetToken",
    DROP COLUMN "passwordResetTokenExpiresAt",
    DROP COLUMN "linkedAccountGroupId";
DROP TABLE "LinkedAccountGroup";

-- A session acts as one role of its account
ALTER TABLE "Session" ADD COLUMN "role" "AccountRole" NOT NULL DEFAULT 'PLAYER';

-- A manager or an admin without an account is an invitation not yet accepted:
-- it shows the name the admin gave it
ALTER TABLE "Manager" ADD COLUMN "invitedName" TEXT;
ALTER TABLE "Admin" ADD COLUMN "invitedName" TEXT;
