// A Discord channel of a team or of a venue: linking it through the webhook
// Discord gave for it, unlinking it, and whether it still takes the posts. A
// team's channel gets its notifications; a venue's, what its manager publishes.

import { prisma } from '@db/prisma';
import type { DiscordChannelStatus } from '@shared/types';
import { ERROR } from '@shared/constants';
import { executeWebhook, normalizeWebhookUrl } from '../integrations/discord/discord-webhook';
import { linkedMessage } from './helpers/discord-message.helper';

/** Who a channel posts for */
export type DiscordChannelOwner = 'team' | 'venue';

export type LinkDiscordRefusal =
  | 'webhookInvalid'      // Not a webhook address of Discord
  | 'webhookRefused'      // Discord does not know it
  | 'discordUnreachable'; // Discord did not answer, or failed

/** How a refused link is answered, as an HTTP status and an error */
export const DISCORD_LINK_REFUSALS: Record<LinkDiscordRefusal, { status: number; error: string }> = {
  webhookInvalid: { status: 400, error: ERROR.discordWebhookInvalid },
  webhookRefused: { status: 422, error: ERROR.discordWebhookRefused },
  discordUnreachable: { status: 502, error: ERROR.discordUnreachable },
};

interface ChannelColumns {
  discordWebhookUrl: string | null;
  discordWebhookBrokenAt: Date | null;
}

// Each owner keeps its webhook, and when Discord refused it, on its own row
const OWNERS: Record<DiscordChannelOwner, {
  name: (id: string) => Promise<string>;
  read: (id: string) => Promise<ChannelColumns | null>;
  save: (id: string, columns: ChannelColumns) => Promise<unknown>;
}> = {
  team: {
    name: async id => (await prisma.team.findUniqueOrThrow({ where: { id }, select: { name: true } })).name,
    read: id => prisma.team.findUnique({ where: { id }, select: { discordWebhookUrl: true, discordWebhookBrokenAt: true } }),
    save: (id, data) => prisma.team.update({ where: { id }, data, select: { id: true } }),
  },
  venue: {
    name: async id => (await prisma.venue.findUniqueOrThrow({ where: { id }, select: { name: true } })).name,
    read: id => prisma.venue.findUnique({ where: { id }, select: { discordWebhookUrl: true, discordWebhookBrokenAt: true } }),
    save: (id, data) => prisma.venue.update({ where: { id }, data, select: { id: true } }),
  },
};

/**
 * Post in a Discord channel: the webhook is kept once Discord took a first
 * message through it, which tells whoever linked it that it works. A webhook
 * replaced this way posts again even if the former one broke.
 */
export async function linkDiscordChannel(owner: DiscordChannelOwner, ownerId: string, input: unknown): Promise<{ refusal?: LinkDiscordRefusal }> {
  const url = normalizeWebhookUrl(input);
  if (!url) return { refusal: 'webhookInvalid' };

  const outcome = await executeWebhook(url, linkedMessage(owner, await OWNERS[owner].name(ownerId)));
  if (outcome.status === 'refused') return { refusal: 'webhookRefused' };
  if (outcome.status === 'failed') return { refusal: 'discordUnreachable' };

  await OWNERS[owner].save(ownerId, { discordWebhookUrl: url, discordWebhookBrokenAt: null });
  return {};
}

/** Stop posting on Discord */
export async function unlinkDiscordChannel(owner: DiscordChannelOwner, ownerId: string): Promise<void> {
  await OWNERS[owner].save(ownerId, { discordWebhookUrl: null, discordWebhookBrokenAt: null });
}

/** Whether a team or a venue posts on Discord, and whether Discord still takes its posts */
export async function discordChannelStatus(owner: DiscordChannelOwner, ownerId: string): Promise<DiscordChannelStatus> {
  const columns = await OWNERS[owner].read(ownerId);
  if (!columns?.discordWebhookUrl) return 'none';
  return columns.discordWebhookBrokenAt ? 'broken' : 'linked';
}
