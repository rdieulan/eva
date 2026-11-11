// Integration tests - What a venue publishes, on the channel of its own
// Discord: each competition and event, published and withdrawn, once, when
// the venue linked a channel Discord still takes
//
// Discord is never called: the webhook call is mocked, the address checks are real.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser } from './helpers/auth';
import { prisma } from './helpers/db';
import { executeWebhook } from '../../server/src/integrations/discord/discord-webhook';
import { settleDiscordPosts } from '../../server/src/services/discord-channel.service';
import { shiftDay, toParisTime } from '@shared/utils/date.utils';

vi.mock('../../server/src/integrations/discord/discord-webhook', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/discord/discord-webhook')>(),
  executeWebhook: vi.fn(),
}));

const webhook = vi.mocked(executeWebhook);
const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abc_DEF-123';

let venuesMade = 0;
async function venue() {
  venuesMade += 1;
  return prisma.venue.create({
    data: { slug: `salle-d-${venuesMade}`, name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test', leagueDivisionCount: 3 },
  });
}

// A signed-in player holding the manager role of a venue, the session switched to it
async function managerOf(venueId: string) {
  const { user, token } = await createAuthenticatedUser();
  const manager = await prisma.manager.create({ data: {} });
  await prisma.user.update({ where: { id: user.id }, data: { managerId: manager.id } });
  await prisma.venueManager.create({ data: { managerId: manager.id, venueId } });
  await request(app).put('/api/auth/role').set(authHeader(token)).send({ role: 'manager' }).expect(200);
  return token;
}

// A venue whose manager linked the channel of its Discord, and that manager
async function linkedVenue() {
  const nimes = await venue();
  const token = await managerOf(nimes.id);
  await request(app).put(`/api/manager/venues/${nimes.id}/discord`).set(authHeader(token)).send({ webhookUrl: WEBHOOK }).expect(200);
  webhook.mockClear();
  return { nimes, token };
}

const DAY = shiftDay(toParisTime(new Date()).day, 4);
const NIGHT = { title: 'Nocturne', date: DAY, startTime: '21:00', endTime: '23:59', description: 'Ouverte à tous' };

// The cards posted since the last clear, by their title
function postedTitles() {
  return webhook.mock.calls.map(([, message]) => message.embeds[0]!.title);
}

beforeEach(() => {
  webhook.mockReset();
  webhook.mockResolvedValue({ status: 'sent' });
});

describe('The publications of a venue on its Discord', () => {
  it('posts an event once when it is published, and its withdrawal', async () => {
    const { nimes, token } = await linkedVenue();

    const published = await request(app).post(`/api/manager/venues/${nimes.id}/events`).set(authHeader(token)).send(NIGHT).expect(201);
    await settleDiscordPosts();

    expect(webhook).toHaveBeenCalledTimes(1);
    expect(webhook.mock.calls[0]![0]).toBe(WEBHOOK);
    expect(webhook.mock.calls[0]![1].embeds[0]).toMatchObject({ author: { name: 'Nocturne' }, title: '📅\u2002Nouvel événement' });

    await request(app).delete(`/api/manager/venues/${nimes.id}/events/${published.body.id}`).set(authHeader(token)).expect(204);
    await settleDiscordPosts();
    expect(postedTitles()).toEqual(['📅\u2002Nouvel événement', '🗑️\u2002Événement annulé']);
  });

  it('posts a competition with what it is, and its withdrawal', async () => {
    const { nimes, token } = await linkedVenue();

    const published = await request(app).post(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token))
      .send({ ...NIGHT, title: 'Journée de la Division 2', division: 2, startTime: '14:00', endTime: '19:00' })
      .expect(201);
    await settleDiscordPosts();
    await request(app).delete(`/api/manager/venues/${nimes.id}/competitions/${published.body.id}`).set(authHeader(token)).expect(204);
    await settleDiscordPosts();

    expect(postedTitles()).toEqual(['🏆\u2002Nouvelle compétition', '🗑️\u2002Compétition annulée']);
    expect(webhook.mock.calls[0]![1].embeds[0]!.description).toContain('Division 2');
  });

  it('posts nothing for a venue that linked no channel', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);

    await request(app).post(`/api/manager/venues/${nimes.id}/events`).set(authHeader(token)).send(NIGHT).expect(201);
    await settleDiscordPosts();

    expect(webhook).not.toHaveBeenCalled();
  });

  it('stops at a webhook Discord no longer knows, and says so in Ma salle', async () => {
    const { nimes, token } = await linkedVenue();
    webhook.mockResolvedValueOnce({ status: 'refused' });

    await request(app).post(`/api/manager/venues/${nimes.id}/events`).set(authHeader(token)).send(NIGHT).expect(201);
    await settleDiscordPosts();
    const settings = await request(app).get(`/api/manager/venues/${nimes.id}`).set(authHeader(token)).expect(200);
    expect(settings.body.discordChannel).toBe('broken');

    webhook.mockClear();
    await request(app).post(`/api/manager/venues/${nimes.id}/events`).set(authHeader(token)).send({ ...NIGHT, title: 'Soirée' }).expect(201);
    await settleDiscordPosts();
    expect(webhook).not.toHaveBeenCalled();
  });

  it('publishes even when Discord fails: the post never holds the publication up', async () => {
    const { nimes, token } = await linkedVenue();
    webhook.mockResolvedValueOnce({ status: 'failed', reason: 'HTTP 500' });

    await request(app).post(`/api/manager/venues/${nimes.id}/events`).set(authHeader(token)).send(NIGHT).expect(201);
    await settleDiscordPosts();

    const settings = await request(app).get(`/api/manager/venues/${nimes.id}`).set(authHeader(token)).expect(200);
    expect(settings.body.discordChannel).toBe('linked');
    expect(await prisma.venueEvent.count({ where: { venueId: nimes.id } })).toBe(1);
  });
});
