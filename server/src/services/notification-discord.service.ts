// The team's Discord channel as a notification medium: each notification of a
// team that linked one is posted there once, as a card (discord-message.helper).
// A post never holds up what was done: it runs on its own, and a failure is
// logged.

import { prisma } from '@db/prisma';
import type { NotificationContent } from '@shared/types';
import type { TeamLogoMimeType } from '@shared/constants';
import { describeNotification } from '@shared/utils';
import { executeWebhook, type DiscordMessage, type WebhookFile } from '../integrations/discord/discord-webhook';
import { notificationMessage } from './helpers/discord-message.helper';
import type { NotificationChannel, NotificationDelivery } from '@services/notification.service';
import { logger } from '@utils/logger';

const LOGO_EXTENSIONS: Record<TeamLogoMimeType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// A team's logo as a file to send with a card, when it has one
async function logoFile(teamId: string | null | undefined): Promise<WebhookFile | null> {
  if (!teamId) return null;
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { logoData: true, logoType: true } });
  if (!team?.logoData || !team.logoType) return null;
  const extension = LOGO_EXTENSIONS[team.logoType as TeamLogoMimeType] ?? 'png';
  return { name: `logo.${extension}`, type: team.logoType, data: team.logoData };
}

/**
 * A notification as a Discord card, with the other team's logo sent along:
 * Discord shows it from the message itself, whatever the app's address
 */
export async function discordCard(content: NotificationContent, base?: string | null): Promise<{ message: DiscordMessage; files: WebhookFile[] }> {
  const logo = await logoFile(describeNotification(content).who?.teamId);
  return { message: notificationMessage(content, { base, logo: logo?.name ?? null }), files: logo ? [logo] : [] };
}

// The posts under way: what was done never waits for them
const underWay = new Set<Promise<void>>();

/** Wait for the posts under way to end */
export async function settleDiscordPosts(): Promise<void> {
  while (underWay.size) await Promise.allSettled([...underWay]);
}

async function post({ teamId, content }: NotificationDelivery): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { discordWebhookUrl: true, discordWebhookBrokenAt: true } });
  if (!team?.discordWebhookUrl || team.discordWebhookBrokenAt) return;

  const { message, files } = await discordCard(content);
  const outcome = await executeWebhook(team.discordWebhookUrl, message, files);
  if (outcome.status === 'refused') {
    // A webhook replaced meanwhile stays as it is
    await prisma.team.updateMany({
      where: { id: teamId, discordWebhookUrl: team.discordWebhookUrl },
      data: { discordWebhookBrokenAt: new Date() },
    });
    logger.warn(`Discord refused the webhook of team ${teamId}: nothing more goes there until it is replaced`);
  } else if (outcome.status === 'failed') {
    logger.warn(`Discord could not take a ${content.kind} notification of team ${teamId}: ${outcome.reason}`);
  }
}

/** Posts once for the team, whatever the players the notification is for */
export const discordChannel: NotificationChannel = {
  name: 'discord',
  async deliver(delivery) {
    const running: Promise<void> = post(delivery)
      .catch(error => logger.error(`Discord post of team ${delivery.teamId} failed:`, error))
      .finally(() => underWay.delete(running));
    underWay.add(running);
  },
};
