-- A team posts its notifications in one of its Discord channels, through the
-- webhook Discord gave for it: no bot, no player account to link
ALTER TABLE "Team" ADD COLUMN "discordWebhookUrl" TEXT;
ALTER TABLE "Team" ADD COLUMN "discordWebhookBrokenAt" TIMESTAMP(3);
