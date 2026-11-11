// Integration tests - A venue's manager changes what the venue published: the
// copies in the teams' calendars follow, the teams concerned are told, and so
// is the venue's own Discord
//
// Discord is never called: the webhook call is mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import type { InboxNotification } from '@shared/types';
import { shiftDay, toParisTime } from '@shared/utils/date.utils';
import { executeWebhook } from '../../server/src/integrations/discord/discord-webhook';
import { settleDiscordPosts } from '../../server/src/services/discord-channel.service';

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
    data: { slug: `salle-m-${venuesMade}`, name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test', leagueDivisionCount: 3 },
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

let leagueTeamsMade = 2447900000000000000n;

// A team of ours whose league team the manager placed in a division of the venue, by its leader
async function teamInDivision(venueId: string, division: number | null) {
  leagueTeamsMade += 1n;
  const leagueTeam = await prisma.leagueTeam.create({
    data: { id: String(leagueTeamsMade), name: `League ${leagueTeamsMade}`, searchName: 'league', memberCount: 4, seenAt: new Date() },
  });
  const leader = await createUserWithTeam();
  await prisma.team.update({ where: { id: leader.team.id }, data: { leagueTeamId: leagueTeam.id } });
  await prisma.leagueDivisionPlace.create({ data: { leagueTeamId: leagueTeam.id, venueId, division, position: 0 } });
  return leader;
}

const today = toParisTime(new Date()).day;
const DAY = shiftDay(today, 3);
const LATER = shiftDay(today, 5);
const SECOND = { division: 2, title: 'Journée de la Division 2', date: DAY, startTime: '14:00', endTime: '19:00', description: null };
const NIGHT = { title: 'Nocturne', date: DAY, startTime: '21:00', endTime: '23:59', description: 'Ouverte à tous' };

async function toldOf(token: string): Promise<InboxNotification[]> {
  return (await request(app).get('/api/notifications').set(authHeader(token)).expect(200)).body.notifications;
}

function answer(token: string, competitionId: string, verb: 'accept' | 'refuse') {
  return request(app).post(`/api/dashboard/competition-offers/${competitionId}/${verb}`).set(authHeader(token)).expect(200);
}

beforeEach(() => {
  webhook.mockReset();
  webhook.mockResolvedValue({ status: 'sent' });
});

describe('changing a competition', () => {
  it('moves the copies of the teams that accepted it, and tells the teams it went to, never one that refused it', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const accepting = await teamInDivision(nimes.id, 2);
    const waiting = await teamInDivision(nimes.id, 2);
    const refusing = await teamInDivision(nimes.id, 2);
    await request(app).put(`/api/manager/venues/${nimes.id}/discord`).set(authHeader(token)).send({ webhookUrl: WEBHOOK }).expect(200);
    const published = await request(app).post(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token)).send(SECOND).expect(201);
    await answer(accepting.token, published.body.id, 'accept');
    await answer(refusing.token, published.body.id, 'refuse');
    await settleDiscordPosts();
    webhook.mockClear();

    const changed = await request(app).put(`/api/manager/venues/${nimes.id}/competitions/${published.body.id}`).set(authHeader(token))
      .send({ ...SECOND, date: LATER, startTime: '15:00', endTime: '20:00', description: 'Convocation 14:30' });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ date: LATER, startTime: '15:00', description: 'Convocation 14:30', answers: { pending: 1, accepted: 1, refused: 1 } });
    const copy = await prisma.calendarEvent.findFirstOrThrow({ where: { teamId: accepting.team.id, venueCompetitionId: published.body.id } });
    expect([copy.date.toISOString().slice(0, 10), copy.startTime, copy.endTime, copy.description]).toEqual([LATER, '15:00', '20:00', 'Convocation 14:30']);

    const [toAccepting] = (await toldOf(accepting.token)).filter(told => told.kind === 'COMPETITION_CHANGED');
    expect(toAccepting!.data).toMatchObject({ date: LATER, before: { date: DAY, startTime: '14:00', endTime: '19:00' }, eventId: copy.id });
    const [toWaiting] = (await toldOf(waiting.token)).filter(told => told.kind === 'COMPETITION_CHANGED');
    expect(toWaiting!.data).toMatchObject({ eventId: null });
    expect((await toldOf(refusing.token)).some(told => told.kind === 'COMPETITION_CHANGED')).toBe(false);

    await settleDiscordPosts();
    expect(webhook.mock.calls.map(([, message]) => message.embeds[0]!.title)).toEqual(['✏️\u2002Compétition modifiée']);
  });

  it('tells nobody of a change that changes nothing', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const leader = await teamInDivision(nimes.id, 2);
    const published = await request(app).post(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token)).send(SECOND).expect(201);

    await request(app).put(`/api/manager/venues/${nimes.id}/competitions/${published.body.id}`).set(authHeader(token)).send(SECOND).expect(200);

    expect((await toldOf(leader.token)).map(told => told.kind)).toEqual(['COMPETITION_OFFERED']);
  });

  it('offers a day moved to another division to its teams, and takes it back from the teams of the former that had not answered', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const accepting = await teamInDivision(nimes.id, 2);
    const waiting = await teamInDivision(nimes.id, 2);
    const third = await teamInDivision(nimes.id, 3);
    const published = await request(app).post(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token)).send(SECOND).expect(201);
    await answer(accepting.token, published.body.id, 'accept');

    const changed = await request(app).put(`/api/manager/venues/${nimes.id}/competitions/${published.body.id}`).set(authHeader(token))
      .send({ ...SECOND, division: 3, title: 'Journée de la Division 3' });

    expect(changed.body).toMatchObject({ division: 3, answers: { pending: 1, accepted: 1, refused: 0 } });
    expect((await toldOf(third.token)).map(told => told.kind)).toEqual(['COMPETITION_OFFERED']);
    expect((await toldOf(waiting.token)).map(told => told.kind)).toEqual(['COMPETITION_OFFERED']);
    expect((await toldOf(accepting.token)).map(told => told.kind)).toContain('COMPETITION_CHANGED');
  });

  it('refuses a change that does not hold together, and one of another venue\'s competition', async () => {
    const nimes = await venue();
    const agen = await venue();
    const token = await managerOf(nimes.id);
    const other = await managerOf(agen.id);
    const published = await request(app).post(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token)).send(SECOND).expect(201);
    const url = `/api/manager/venues/${nimes.id}/competitions/${published.body.id}`;

    const invalid = await request(app).put(url).set(authHeader(token)).send({ ...SECOND, endTime: '13:00' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors).toContain(ERROR.publicationInvalid);
    expect((await request(app).put(url).set(authHeader(token)).send({ ...SECOND, division: 4 })).body.errors).toContain(ERROR.competitionDivisionInvalid);
    expect((await request(app).put(`/api/manager/venues/${agen.id}/competitions/${published.body.id}`).set(authHeader(other)).send(SECOND)).status).toBe(404);
  });
});

describe('changing an event', () => {
  it('moves the copies of the teams that added it, and tells them and the venue\'s Discord', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const adding = await createUserWithTeam();
    const other = await createUserWithTeam();
    await prisma.team.updateMany({ where: { id: { in: [adding.team.id, other.team.id] } }, data: { venueId: nimes.id } });
    await request(app).put(`/api/manager/venues/${nimes.id}/discord`).set(authHeader(token)).send({ webhookUrl: WEBHOOK }).expect(200);
    const published = await request(app).post(`/api/manager/venues/${nimes.id}/events`).set(authHeader(token)).send(NIGHT).expect(201);
    const added = await request(app).post(`/api/calendar/venue-events/${published.body.id}/add`).set(authHeader(adding.token)).expect(201);
    await settleDiscordPosts();
    webhook.mockClear();

    const changed = await request(app).put(`/api/manager/venues/${nimes.id}/events/${published.body.id}`).set(authHeader(token))
      .send({ ...NIGHT, title: 'Nocturne spéciale' });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ title: 'Nocturne spéciale', teamsAdding: 1 });
    expect((await prisma.calendarEvent.findUniqueOrThrow({ where: { id: added.body.eventId } })).title).toBe('Nocturne spéciale');
    const [told] = (await toldOf(adding.token)).filter(notification => notification.kind === 'VENUE_EVENT_CHANGED');
    expect(told!.data).toMatchObject({ title: 'Nocturne spéciale', before: null, eventId: added.body.eventId });
    expect(await toldOf(other.token)).toEqual([]);
    await settleDiscordPosts();
    expect(webhook.mock.calls.map(([, message]) => message.embeds[0]!.title)).toEqual(['✏️\u2002Événement modifié']);
  });

  it('answers 404 for an event the venue does not have', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);

    const res = await request(app).put(`/api/manager/venues/${nimes.id}/events/nope`).set(authHeader(token)).send(NIGHT);

    expect(res.status).toBe(404);
    expect(res.body.errors).toContain(ERROR.venueEventNotFound);
  });
});
