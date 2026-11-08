// A team's Discord channel: linking it through the webhook Discord gave for
// it, unlinking it, and whether it still takes the notifications

import { prisma } from '@db/prisma';
import type { TeamDiscordStatus } from '@shared/types';
import { executeWebhook, normalizeWebhookUrl } from '../integrations/discord/discord-webhook';
import { linkedMessage } from './helpers/discord-message.helper';

export type LinkTeamDiscordRefusal =
  | 'webhookInvalid'      // Not a webhook address of Discord
  | 'webhookRefused'      // Discord does not know it
  | 'discordUnreachable'; // Discord did not answer, or failed

/**
 * Post a team's notifications in a Discord channel: the webhook is kept once
 * Discord took a first message through it, which tells the team it works.
 * A webhook replaced this way posts again even if the former one broke.
 */
export async function linkTeamDiscord(teamId: string, input: unknown): Promise<{ refusal?: LinkTeamDiscordRefusal }> {
  const url = normalizeWebhookUrl(input);
  if (!url) return { refusal: 'webhookInvalid' };

  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId }, select: { name: true } });
  const outcome = await executeWebhook(url, linkedMessage(team.name));
  if (outcome.status === 'refused') return { refusal: 'webhookRefused' };
  if (outcome.status === 'failed') return { refusal: 'discordUnreachable' };

  await prisma.team.update({ where: { id: teamId }, data: { discordWebhookUrl: url, discordWebhookBrokenAt: null } });
  return {};
}

/** Stop posting a team's notifications on Discord */
export async function unlinkTeamDiscord(teamId: string): Promise<void> {
  await prisma.team.update({ where: { id: teamId }, data: { discordWebhookUrl: null, discordWebhookBrokenAt: null } });
}

/** Whether a team posts its notifications on Discord, and whether Discord still takes them */
export async function teamDiscordStatus(teamId: string): Promise<TeamDiscordStatus> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { discordWebhookUrl: true, discordWebhookBrokenAt: true } });
  if (!team?.discordWebhookUrl) return 'none';
  return team.discordWebhookBrokenAt ? 'broken' : 'linked';
}
