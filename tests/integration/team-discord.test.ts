// Integration tests - A team's Discord channel: linking it through a webhook,
// and the team's notifications posted there
//
// Discord is never called: the webhook call is mocked, the address checks are real.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createTeamMember, createUserWithTeam, authHeader } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import type { NotificationContent } from '@shared/types';
import { executeWebhook } from '../../server/src/integrations/discord/discord-webhook';
import { notify } from '../../server/src/services/notification.service';
import { settleDiscordPosts } from '../../server/src/services/discord-channel.service';

vi.mock('../../server/src/integrations/discord/discord-webhook', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/discord/discord-webhook')>(),
  executeWebhook: vi.fn(),
}));

const webhook = vi.mocked(executeWebhook);

const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abc_DEF-123';
const OTHER_WEBHOOK = 'https://discord.com/api/webhooks/987654321/zyx-987';

const RECEIVED: NotificationContent = {
  kind: 'SCRIM_PROPOSAL_RECEIVED',
  data: {
    date: '2030-06-10', startTime: '20:00', endTime: '21:20', venueId: 'venue-nimes', venueName: 'Nîmes', arenaNumber: null,
    searchId: 'search-1', teamName: 'Les Rivaux', message: null,
  },
};


function link(token: string, webhookUrl: unknown) {
  return request(app).put('/api/teams/current/discord').set(authHeader(token)).send({ webhookUrl });
}

async function statusOf(token: string) {
  return (await request(app).get('/api/teams/current').set(authHeader(token)).expect(200)).body.discord;
}

beforeEach(() => {
  webhook.mockReset();
  webhook.mockResolvedValue({ status: 'sent' });
});

describe('PUT /api/teams/current/discord', () => {
  it('links the channel once Discord took a first message there, and never gives the webhook back', async () => {
    const leader = await createUserWithTeam();
    expect(await statusOf(leader.token)).toBe('none');

    const res = await link(leader.token, ` ${WEBHOOK}/ `);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ discord: 'linked' });
    expect(webhook).toHaveBeenCalledTimes(1);
    expect(webhook.mock.calls[0]![0]).toBe(WEBHOOK);
    expect(webhook.mock.calls[0]![1].embeds[0]).toMatchObject({ title: '🔗\u2002Salon relié', description: `Les notifications de l'équipe ${leader.team.name} arriveront ici.` });
    expect(await statusOf(leader.token)).toBe('linked');

    // Nothing the app reads of the team carries it
    const team = await request(app).get('/api/teams/current').set(authHeader(leader.token));
    const renamed = await request(app).put('/api/teams/current').set(authHeader(leader.token)).send({ name: 'Nouveau nom' });
    for (const body of [team.body, renamed.body]) {
      expect(JSON.stringify(body)).not.toContain('api/webhooks');
    }
  });

  it('refuses an address that is not a Discord webhook, without calling anything', async () => {
    const leader = await createUserWithTeam();

    for (const input of ['https://evil.example/api/webhooks/1/x', 'http://discord.com/api/webhooks/1/x', 'pas une adresse', undefined]) {
      const res = await link(leader.token, input);
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.discordWebhookInvalid);
    }
    expect(webhook).not.toHaveBeenCalled();
    expect(await statusOf(leader.token)).toBe('none');
  });

  it('says when Discord does not know the webhook, or does not answer, and keeps nothing', async () => {
    const leader = await createUserWithTeam();

    webhook.mockResolvedValueOnce({ status: 'refused' });
    const refused = await link(leader.token, WEBHOOK);
    expect(refused.status).toBe(422);
    expect(refused.body.errors).toContain(ERROR.discordWebhookRefused);

    webhook.mockResolvedValueOnce({ status: 'failed', reason: 'HTTP 503' });
    const failed = await link(leader.token, WEBHOOK);
    expect(failed.status).toBe(502);
    expect(failed.body.errors).toContain(ERROR.discordUnreachable);

    expect(await statusOf(leader.token)).toBe('none');
  });

  it('is for whoever manages the team', async () => {
    const leader = await createUserWithTeam();
    const member = await createTeamMember(leader.token, leader.team.id);

    expect((await link(member.token, WEBHOOK)).status).toBe(403);
    expect((await request(app).delete('/api/teams/current/discord').set(authHeader(member.token))).status).toBe(403);
    expect(webhook).not.toHaveBeenCalled();
    // The members see whether it is there
    await link(leader.token, WEBHOOK).expect(200);
    expect(await statusOf(member.token)).toBe('linked');
  });
});

describe('DELETE /api/teams/current/discord', () => {
  it('stops posting the team\'s notifications on Discord', async () => {
    const leader = await createUserWithTeam();
    await link(leader.token, WEBHOOK).expect(200);

    await request(app).delete('/api/teams/current/discord').set(authHeader(leader.token)).expect(204);

    expect(await statusOf(leader.token)).toBe('none');
    webhook.mockClear();
    await notify(RECEIVED, { teamId: leader.team.id });
    await settleDiscordPosts();
    expect(webhook).not.toHaveBeenCalled();
  });
});

describe('The team\'s notifications on Discord', () => {
  it('posts a notification of the team in its channel once, in the words of the bell', async () => {
    const leader = await createUserWithTeam();
    await createTeamMember(leader.token, leader.team.id);
    await link(leader.token, WEBHOOK).expect(200);
    webhook.mockClear();

    await notify(RECEIVED, { teamId: leader.team.id });
    await settleDiscordPosts();

    expect(webhook).toHaveBeenCalledTimes(1);
    expect(webhook.mock.calls[0]![0]).toBe(WEBHOOK);
    expect(webhook.mock.calls[0]![1].embeds[0]).toMatchObject({
      author: { name: 'Les Rivaux' },
      title: '🤝\u2002Match proposé',
      description: '📅\u2002**lun. 10/06 · 20:00 – 21:20**\n\n📍\u2002Nîmes',
    });
  });

  it('sends the other team\'s logo with the card when it has one, and nothing when it has none', async () => {
    const leader = await createUserWithTeam();
    const rival = await createUserWithTeam();
    const logo = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    await prisma.team.update({ where: { id: rival.team.id }, data: { logoData: logo, logoType: 'image/png', logoUpdatedAt: new Date() } });
    await link(leader.token, WEBHOOK).expect(200);
    webhook.mockClear();

    // One after the other: posts run on their own, in no set order
    await notify({ ...RECEIVED, data: { ...RECEIVED.data, teamName: rival.team.name, teamId: rival.team.id } } as NotificationContent, { teamId: leader.team.id });
    await settleDiscordPosts();
    await notify(RECEIVED, { teamId: leader.team.id });
    await settleDiscordPosts();

    const [withLogo, withoutLogo] = webhook.mock.calls;
    expect(withLogo![1].embeds[0]!.thumbnail).toEqual({ url: 'attachment://logo.png' });
    expect(withLogo![2]).toEqual([{ name: 'logo.png', type: 'image/png', data: logo }]);
    expect(withoutLogo![1].embeds[0]).not.toHaveProperty('thumbnail');
    expect(withoutLogo![2]).toEqual([]);
  });

  it('posts nothing for a team that linked no channel', async () => {
    const leader = await createUserWithTeam();

    await notify(RECEIVED, { teamId: leader.team.id });
    await settleDiscordPosts();

    expect(webhook).not.toHaveBeenCalled();
  });

  it('stops at a webhook Discord no longer knows, says so to the team, and starts again with a new one', async () => {
    const leader = await createUserWithTeam();
    await link(leader.token, WEBHOOK).expect(200);

    webhook.mockResolvedValueOnce({ status: 'refused' });
    await notify(RECEIVED, { teamId: leader.team.id });
    await settleDiscordPosts();
    expect(await statusOf(leader.token)).toBe('broken');

    webhook.mockClear();
    await notify(RECEIVED, { teamId: leader.team.id });
    await settleDiscordPosts();
    expect(webhook).not.toHaveBeenCalled();

    await link(leader.token, OTHER_WEBHOOK).expect(200);
    expect(await statusOf(leader.token)).toBe('linked');
    await notify(RECEIVED, { teamId: leader.team.id });
    await settleDiscordPosts();
    expect(webhook.mock.calls.at(-1)![0]).toBe(OTHER_WEBHOOK);
  });

  it('keeps the channel through a failure of Discord: the next notification goes there again', async () => {
    const leader = await createUserWithTeam();
    await link(leader.token, WEBHOOK).expect(200);

    webhook.mockResolvedValueOnce({ status: 'failed', reason: 'HTTP 503' });
    await notify(RECEIVED, { teamId: leader.team.id });
    await settleDiscordPosts();

    expect(await statusOf(leader.token)).toBe('linked');
    const stored = await prisma.team.findUniqueOrThrow({ where: { id: leader.team.id }, select: { discordWebhookUrl: true } });
    expect(stored.discordWebhookUrl).toBe(WEBHOOK);
  });
});
