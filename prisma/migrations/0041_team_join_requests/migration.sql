-- A player without a team asks to join one found through its league team; its
-- leader and the members who may invite answer, told by a notification. One
-- request waits at a time for a player, and a refusal stays: that team is not
-- asked again by them.
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'REFUSED');

ALTER TYPE "NotificationKind" ADD VALUE 'TEAM_JOIN_REQUESTED';

CREATE TABLE "TeamJoinRequest" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "refusalSeenAt" TIMESTAMP(3),

    CONSTRAINT "TeamJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamJoinRequest_teamId_status_idx" ON "TeamJoinRequest"("teamId", "status");

CREATE UNIQUE INDEX "TeamJoinRequest_playerId_teamId_key" ON "TeamJoinRequest"("playerId", "teamId");

ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
