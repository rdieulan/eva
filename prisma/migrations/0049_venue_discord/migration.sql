-- Where a venue's publications are to be posted on Discord: the webhook of a
-- channel of its own server, linked by its manager, and when Discord refused it
ALTER TABLE "Venue" ADD COLUMN     "discordWebhookBrokenAt" TIMESTAMP(3),
ADD COLUMN     "discordWebhookUrl" TEXT;
