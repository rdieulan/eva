// A Discord channel of a team or of a venue: linking it through the webhook
// Discord gave for it, unlinking it, whether it still takes the posts, and
// posting there. A team's channel gets its notifications; a venue's, what its
// manager publishes. A post never holds up what was done: it runs on its own,
// and a failure is logged.

import { prisma } from '@db/prisma';
import type { DiscordChannelStatus } from '@shared/types';
import { ERROR } from '@shared/constants';
import { logger } from '@utils/logger';
import { executeWebhook, normalizeWebhookUrl, type DiscordMessage, type WebhookFile } from '../integrations/discord/discord-webhook';
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

// Each owner keeps its webhook, and when Discord refused it, on its own row.
// A refusal marks the webhook it was given for: one replaced meanwhile stays as it is.
const OWNERS: Record<DiscordChannelOwner, {
  name: (id: string) => Promise<string>;
  read: (id: string) => Promise<ChannelColumns | null>;
  save: (id: string, columns: ChannelColumns) => Promise<unknown>;
  markBroken: (id: string, webhookUrl: string) => Promise<unknown>;
}> = {
  team: {
    name: async id => (await prisma.team.findUniqueOrThrow({ where: { id }, select: { name: true } })).name,
    read: id => prisma.team.findUnique({ where: { id }, select: { discordWebhookUrl: true, discordWebhookBrokenAt: true } }),
    save: (id, data) => prisma.team.update({ where: { id }, data, select: { id: true } }),
    markBroken: (id, webhookUrl) => prisma.team.updateMany({
      where: { id, discordWebhookUrl: webhookUrl },
      data: { discordWebhookBrokenAt: new Date() },
    }),
  },
  venue: {
    name: async id => (await prisma.venue.findUniqueOrThrow({ where: { id }, select: { name: true } })).name,
    read: id => prisma.venue.findUnique({ where: { id }, select: { discordWebhookUrl: true, discordWebhookBrokenAt: true } }),
    save: (id, data) => prisma.venue.update({ where: { id }, data, select: { id: true } }),
    markBroken: (id, webhookUrl) => prisma.venue.updateMany({
      where: { id, discordWebhookUrl: webhookUrl },
      data: { discordWebhookBrokenAt: new Date() },
    }),
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

/**
 * Post in the channel of a team or a venue, when it linked one Discord still
 * takes; the message is made only then. A webhook Discord refuses stops the
 * posts there until it is replaced; a failure of Discord changes nothing.
 */
export async function postInDiscordChannel(
  owner: DiscordChannelOwner,
  ownerId: string,
  what: string, // What is posted, for the logs: "a SCRIM_MATCH_MADE notification"
  compose: () => Promise<{ message: DiscordMessage; files?: WebhookFile[] }>,
): Promise<void> {
  const columns = await OWNERS[owner].read(ownerId);
  if (!columns?.discordWebhookUrl || columns.discordWebhookBrokenAt) return;

  const { message, files = [] } = await compose();
  const outcome = await executeWebhook(columns.discordWebhookUrl, message, files);
  if (outcome.status === 'refused') {
    await OWNERS[owner].markBroken(ownerId, columns.discordWebhookUrl);
    logger.warn(`Discord refused the webhook of ${owner} ${ownerId}: nothing more goes there until it is replaced`);
  } else if (outcome.status === 'failed') {
    logger.warn(`Discord could not take ${what} of ${owner} ${ownerId}: ${outcome.reason}`);
  }
}

// The posts under way: what was done never waits for them
const underWay = new Set<Promise<void>>();

/** Run a post on its own: what was done does not wait for it, and its failure is logged */
export function postInBackground(label: string, post: () => Promise<void>): void {
  const running: Promise<void> = post()
    .catch(error => logger.error(`${label} failed:`, error))
    .finally(() => underWay.delete(running));
  underWay.add(running);
}

/** Wait for the posts under way to end */
export async function settleDiscordPosts(): Promise<void> {
  while (underWay.size) await Promise.allSettled([...underWay]);
}
