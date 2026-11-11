// The team's Discord channel as a notification medium: each notification of a
// team that linked one is posted there once, as a card (discord-message.helper),
// on its own (see discord-channel.service).

import { prisma } from '@db/prisma';
import type { NotificationContent } from '@shared/types';
import type { TeamLogoMimeType } from '@shared/constants';
import { describeNotification } from '@shared/utils';
import type { DiscordMessage, WebhookFile } from '../integrations/discord/discord-webhook';
import { notificationMessage } from './helpers/discord-message.helper';
import { postInBackground, postInDiscordChannel } from '@services/discord-channel.service';
import type { NotificationChannel } from '@services/notification.service';

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

/** Posts once for the team, whatever the players the notification is for */
export const discordChannel: NotificationChannel = {
  name: 'discord',
  async deliver({ teamId, content }) {
    postInBackground(`Discord post of team ${teamId}`, () =>
      postInDiscordChannel('team', teamId, `a ${content.kind} notification`, () => discordCard(content)));
  },
};
