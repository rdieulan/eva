-- Notifications: what happened, told to the players of a team. The information
-- is kept apart from the media that tell it; the app's bell keeps one inbox
-- entry per player

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SCRIM_PROPOSAL_RECEIVED', 'SCRIM_MATCH_MADE', 'SCRIM_PROPOSAL_DECLINED', 'SCRIM_SEARCH_WITHDRAWN', 'SCRIM_MATCH_CANCELLED', 'SCRIM_SEARCH_EXPIRED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "data" JSONB NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationInboxEntry" (
    "notificationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationInboxEntry_pkey" PRIMARY KEY ("notificationId","playerId")
);

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_teamId_idx" ON "Notification"("teamId");

-- CreateIndex
CREATE INDEX "NotificationInboxEntry_playerId_readAt_idx" ON "NotificationInboxEntry"("playerId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationInboxEntry" ADD CONSTRAINT "NotificationInboxEntry_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationInboxEntry" ADD CONSTRAINT "NotificationInboxEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

