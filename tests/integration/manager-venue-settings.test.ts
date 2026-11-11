// Integration tests - The settings of a venue, as its manager reads them: its
// public information, read again on eva.gg at the manager's asking, and the
// channel of its own Discord its publications are to go to
//
// eva.gg and Discord are never called: the list of locations and the webhook
// call are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { COMPETITIVE_GAME_ID } from '@shared/constants';
import { fetchEvaLocations } from '../../server/src/integrations/eva/eva-locations';
import { executeWebhook } from '../../server/src/integrations/discord/discord-webhook';

vi.mock('../../server/src/integrations/eva/eva-locations', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/eva/eva-locations')>(),
  fetchEvaLocations: vi.fn(),
}));
vi.mock('../../server/src/integrations/discord/discord-webhook', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/discord/discord-webhook')>(),
  executeWebhook: vi.fn(),
}));

const locations = vi.mocked(fetchEvaLocations);
const webhook = vi.mocked(executeWebhook);
const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abc_DEF-123';

let venuesMade = 0;
async function venue(externalId: number | null = 51) {
  venuesMade += 1;
  return prisma.venue.create({
    data: { slug: `salle-s-${venuesMade}`, name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test', externalId: externalId === null ? null : externalId + venuesMade },
  });
}

// A signed-in player holding the manager role of these venues, the session switched to it
async function managerOf(...venueIds: string[]) {
  const { user, token } = await createAuthenticatedUser();
  const manager = await prisma.manager.create({ data: {} });
  await prisma.user.update({ where: { id: user.id }, data: { managerId: manager.id } });
  for (const venueId of venueIds) await prisma.venueManager.create({ data: { managerId: manager.id, venueId } });
  await request(app).put('/api/auth/role').set(authHeader(token)).send({ role: 'manager' }).expect(200);
  return token;
}

// A location of eva.gg, as its public list gives it
function location(id: number) {
  return {
    id, name: 'Nîmes', isClosed: false, telephone: '04 66 00 00 00', externalUrl: 'https://nimes.example',
    address: { street: '12 rue Neuve', city: 'Nîmes' },
    socialNetworks: { discord: 'https://discord.gg/nimes', instagram: null, facebook: null, x: null, tiktok: null, youtube: null, twitch: null },
    details: { terrains: [1, 2].map(terrain => ({ id: terrain, games: [{ gameId: COMPETITIVE_GAME_ID }] })) },
  };
}

beforeEach(() => {
  locations.mockReset();
  webhook.mockReset().mockResolvedValue({ status: 'sent' });
});

describe('the settings of a venue', () => {
  it('shows its manager the venue\'s public information, and whether its Discord channel is linked', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);

    const res = await request(app).get(`/api/manager/venues/${nimes.id}`).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: nimes.id, name: 'Nîmes', address: '1 rue du Test', isFromEva: true, discordChannel: 'none' });
    expect(res.body).not.toHaveProperty('externalId');

    const other = await managerOf((await venue()).id);
    expect((await request(app).get(`/api/manager/venues/${nimes.id}`).set(authHeader(other))).status).toBe(403);
  });

  it('reads the venue again on eva.gg at its manager\'s asking, once every five minutes at most', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    locations.mockResolvedValue([location(nimes.externalId!)] as never);

    const res = await request(app).post(`/api/manager/venues/${nimes.id}/refresh`).set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ address: '12 rue Neuve', phone: '04 66 00 00 00', arenaCount: 2, website: 'https://nimes.example', discord: 'https://discord.gg/nimes' });
    expect((await prisma.venue.findUniqueOrThrow({ where: { id: nimes.id } })).address).toBe('12 rue Neuve');
    const again = await request(app).post(`/api/manager/venues/${nimes.id}/refresh`).set(authHeader(token));
    expect(again.status).toBe(429);
    expect(again.body.errors).toContain(ERROR.venueRefreshTooSoon);
    expect(locations).toHaveBeenCalledTimes(1);
  });

  it('says when the venue is not one of eva.gg, or eva.gg no longer lists it', async () => {
    const handMade = await venue(null);
    const listed = await venue();
    const token = await managerOf(handMade.id, listed.id);
    locations.mockResolvedValue([] as never);

    const notFromEva = await request(app).post(`/api/manager/venues/${handMade.id}/refresh`).set(authHeader(token));
    expect(notFromEva.status).toBe(409);
    expect(notFromEva.body.errors).toContain(ERROR.venueNotFromEva);

    const gone = await request(app).post(`/api/manager/venues/${listed.id}/refresh`).set(authHeader(token));
    expect(gone.status).toBe(404);
    expect(gone.body.errors).toContain(ERROR.venueGoneFromEva);
  });

  it('links a channel of the venue\'s own Discord once Discord took a first message there, and never sends its address back', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);

    const linked = await request(app).put(`/api/manager/venues/${nimes.id}/discord`).set(authHeader(token)).send({ webhookUrl: WEBHOOK });

    expect(linked.status).toBe(200);
    expect(webhook).toHaveBeenCalledWith(WEBHOOK, expect.objectContaining({ embeds: [expect.objectContaining({ description: 'Les publications de la salle Nîmes arriveront ici.' })] }));
    const settings = await request(app).get(`/api/manager/venues/${nimes.id}`).set(authHeader(token));
    expect(settings.body.discordChannel).toBe('linked');
    expect(JSON.stringify(settings.body)).not.toContain(WEBHOOK);

    const invalid = await request(app).put(`/api/manager/venues/${nimes.id}/discord`).set(authHeader(token)).send({ webhookUrl: 'https://example.com/hook' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors).toContain(ERROR.discordWebhookInvalid);

    await request(app).delete(`/api/manager/venues/${nimes.id}/discord`).set(authHeader(token)).expect(204);
    expect((await request(app).get(`/api/manager/venues/${nimes.id}`).set(authHeader(token))).body.discordChannel).toBe('none');
  });
});
