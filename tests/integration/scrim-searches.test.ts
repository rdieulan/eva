// Integration tests - Scrim searches (a team puts a run of a venue's slots up for an opponent)
//
// eva.gg is never called: the sessions lookup is mocked so each test decides
// which slots the venue runs that day.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { fetchLocationSessions } from '../../server/src/integrations/eva/eva-sessions';
import { EvaApiError } from '../../server/src/integrations/eva/eva-graphql';
import { clearVenueSlotsCache } from '../../server/src/services/venue-slots.service';

vi.mock('../../server/src/integrations/eva/eva-sessions', () => ({
  fetchLocationSessions: vi.fn(),
}));

const sessions = vi.mocked(fetchLocationSessions);

const NIMES = { id: 'venue-nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue', externalId: 51, arenaCount: 2 };
const HAND_MADE = { id: 'venue-hand', name: 'Garage', city: 'Paris', address: '2 rue' };

// A far-off day, so the tests never fall into the past
const DATE = '2030-06-10';
const MONTH = '2030-06';

function slot(slotId: string, startTime: string, endTime: string, arenaNumber: number, extra: Partial<{ takenSeats: number; isCompetitiveAvailable: boolean }> = {}) {
  return {
    slotId,
    startTime,
    endTime,
    convocationTime: startTime === '20:00' ? '19:50' : startTime,
    arenaNumber,
    takenSeats: 0,
    totalSeats: 10,
    isCompetitiveAvailable: true,
    ...extra,
  };
}

// What Nîmes runs that evening
const DAY_SLOTS = [
  slot('a1-1800', '18:00', '18:40', 1, { isCompetitiveAvailable: false }),
  slot('a1-2000', '20:00', '20:40', 1),
  slot('a1-2040', '20:40', '21:20', 1),
  slot('a1-2120', '21:20', '22:00', 1, { takenSeats: 3 }),
  slot('a2-2040', '20:40', '21:20', 2),
];

beforeEach(async () => {
  sessions.mockReset();
  sessions.mockResolvedValue(DAY_SLOTS);
  clearVenueSlotsCache();
  await prisma.venue.createMany({ data: [NIMES, HAND_MADE] });
});

function open(token: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/scrims/searches')
    .set('Authorization', `Bearer ${token}`)
    .send({ venueId: NIMES.id, date: DATE, evaSlotIds: ['a1-2000', 'a1-2040'], ...body });
}

async function joinAsMember(leaderToken: string, teamId: string): Promise<string> {
  const invite = await request(app)
    .post(`/api/teams/${teamId}/invites`)
    .set('Authorization', `Bearer ${leaderToken}`)
    .send({ expiresInHours: 24, maxUses: 1 })
    .expect(201);
  const { token } = await createAuthenticatedUser();
  await request(app).post(`/api/invites/${invite.body.code}/join`).set('Authorization', `Bearer ${token}`).expect(200);
  return token;
}

describe('POST /api/scrims/searches', () => {
  it('should open a search carrying the times and arena eva.gg gives the slots', async () => {
    const { token, team } = await createUserWithTeam();

    const res = await open(token, {});

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      team: { id: team.id, name: team.name, logoUrl: null },
      venueId: NIMES.id,
      date: DATE,
      arenaNumber: 1,
      evaSlotIds: ['a1-2000', 'a1-2040'],
      startTime: '20:00',
      endTime: '21:20',
      convocationTime: '19:50',
      status: 'OPEN',
      isMine: true,
    });
    expect(sessions).toHaveBeenCalledWith(NIMES.externalId, DATE);
  });

  it('should put the slots in time order whatever order they were sent in', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { evaSlotIds: ['a1-2040', 'a1-2000'] });

    expect(res.status).toBe(201);
    expect(res.body.evaSlotIds).toEqual(['a1-2000', 'a1-2040']);
    expect(res.body.startTime).toBe('20:00');
  });

  it('should accept a single slot', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { evaSlotIds: ['a2-2040'] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ arenaNumber: 2, startTime: '20:40', endTime: '21:20' });
  });

  it('should refuse a slot eva.gg does not list that day', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { evaSlotIds: ['a1-2000', 'nope'] });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsUnknown);
  });

  it('should refuse slots that do not follow each other', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { evaSlotIds: ['a1-2000', 'a1-2120'] });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsNotConsecutive);
  });

  it('should refuse slots on two arenas, even back to back in time', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { evaSlotIds: ['a1-2000', 'a2-2040'] });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsNotConsecutive);
  });

  it('should refuse a slot closed to the competitive mode', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { evaSlotIds: ['a1-1800'] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsNotCompetitive);
  });

  it('should refuse a slot somebody is already booked on', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { evaSlotIds: ['a1-2040', 'a1-2120'] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchSlotsNotFree);
  });

  it('should refuse a second search of the team on one of the same slots', async () => {
    const { token } = await createUserWithTeam();
    await open(token, {}).expect(201);

    const res = await open(token, { evaSlotIds: ['a1-2040'] });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchAlreadyOpen);
    expect(await prisma.scrimSearch.count()).toBe(1);
  });

  it('should let another team search on the same slots', async () => {
    const { token: first } = await createUserWithTeam();
    const { token: second } = await createUserWithTeam();
    await open(first, {}).expect(201);

    const res = await open(second, {});

    expect(res.status).toBe(201);
  });

  it('should refuse a day gone by', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { date: '2020-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.scrimSearchDateInPast);
    expect(sessions).not.toHaveBeenCalled();
  });

  it('should refuse a venue that is not on eva.gg', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venueId: HAND_MADE.id });

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.venueNotOnEva);
  });

  it('should answer 404 for a venue that does not exist', async () => {
    const { token } = await createUserWithTeam();

    const res = await open(token, { venueId: 'no-such-venue' });

    expect(res.status).toBe(404);
    expect(res.body.errors).toContain(ERROR.venueNotFound);
  });

  it('should refuse a malformed request', async () => {
    const { token } = await createUserWithTeam();

    for (const body of [
      { evaSlotIds: [] },
      { evaSlotIds: ['a1-2000', 'a1-2000'] },
      { evaSlotIds: 'a1-2000' },
      { evaSlotIds: [42] },
    ]) {
      const res = await open(token, body);
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.evaSlotsInvalid);
    }

    expect((await open(token, { date: '2030-13-45' })).body.errors).toContain(ERROR.dateInvalid);
    expect((await open(token, { venueId: '' })).status).toBe(400);
  });

  it('should answer 502 when eva.gg cannot be read', async () => {
    const { token } = await createUserWithTeam();
    sessions.mockRejectedValue(new EvaApiError('down', [], 500));

    const res = await open(token, {});

    expect(res.status).toBe(502);
    expect(res.body.errors).toContain(ERROR.evaUnavailable);
  });

  it('should refuse a member who cannot create events', async () => {
    const { token: leaderToken, team } = await createUserWithTeam();
    const memberToken = await joinAsMember(leaderToken, team.id);

    const res = await open(memberToken, {});

    expect(res.status).toBe(403);
  });

  it('should refuse a player without a team', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await open(token, {});

    expect(res.status).toBe(403);
  });

  it('should reject without authentication', async () => {
    const res = await request(app).post('/api/scrims/searches').send({});

    expect(res.status).toBe(401);
  });
});

describe('GET /api/scrims/searches', () => {
  it('should list the venue searches of every team, flagging the reader\'s own', async () => {
    const { token: mine, team: myTeam } = await createUserWithTeam();
    const { token: theirs, team: theirTeam } = await createUserWithTeam();
    await open(mine, {}).expect(201);
    await open(theirs, { evaSlotIds: ['a2-2040'] }).expect(201);

    const res = await request(app)
      .get('/api/scrims/searches')
      .query({ month: MONTH, venueId: NIMES.id })
      .set('Authorization', `Bearer ${mine}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ team: { id: myTeam.id }, isMine: true, startTime: '20:00' });
    expect(res.body[1]).toMatchObject({ team: { id: theirTeam.id }, isMine: false, startTime: '20:40' });
  });

  it('should list only the reader\'s team searches when no venue is given', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: theirs } = await createUserWithTeam();
    await open(mine, {}).expect(201);
    await open(theirs, { evaSlotIds: ['a2-2040'] }).expect(201);

    const res = await request(app)
      .get('/api/scrims/searches')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${mine}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].isMine).toBe(true);
  });

  it('should keep to the month asked for and to open searches', async () => {
    const { token } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);
    await prisma.scrimSearch.update({ where: { id: opened.body.id }, data: { status: 'MATCHED' } });

    const sameMonth = await request(app)
      .get('/api/scrims/searches')
      .query({ month: MONTH, venueId: NIMES.id })
      .set('Authorization', `Bearer ${token}`);
    expect(sameMonth.body).toEqual([]);

    await prisma.scrimSearch.update({ where: { id: opened.body.id }, data: { status: 'OPEN' } });
    const otherMonth = await request(app)
      .get('/api/scrims/searches')
      .query({ month: '2030-07', venueId: NIMES.id })
      .set('Authorization', `Bearer ${token}`);
    expect(otherMonth.body).toEqual([]);
  });

  it('should refuse a bad month and a player without a team', async () => {
    const { token } = await createUserWithTeam();
    const badMonth = await request(app)
      .get('/api/scrims/searches')
      .query({ month: '2030-6' })
      .set('Authorization', `Bearer ${token}`);
    expect(badMonth.status).toBe(400);

    const { token: loner } = await createAuthenticatedUser();
    const noTeam = await request(app)
      .get('/api/scrims/searches')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${loner}`);
    expect(noTeam.status).toBe(403);
  });
});

describe('DELETE /api/scrims/searches/:id', () => {
  it('should withdraw an open search of the team', async () => {
    const { token } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);

    const res = await request(app)
      .delete(`/api/scrims/searches/${opened.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(await prisma.scrimSearch.count()).toBe(0);
  });

  it('should refuse to withdraw another team\'s search', async () => {
    const { token: mine } = await createUserWithTeam();
    const { token: theirs } = await createUserWithTeam();
    const opened = await open(theirs, {}).expect(201);

    const res = await request(app)
      .delete(`/api/scrims/searches/${opened.body.id}`)
      .set('Authorization', `Bearer ${mine}`);

    expect(res.status).toBe(403);
    expect(await prisma.scrimSearch.count()).toBe(1);
  });

  it('should keep a search that already found an opponent', async () => {
    const { token } = await createUserWithTeam();
    const opened = await open(token, {}).expect(201);
    await prisma.scrimSearch.update({ where: { id: opened.body.id }, data: { status: 'MATCHED' } });

    const res = await request(app)
      .delete(`/api/scrims/searches/${opened.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.errors).toContain(ERROR.scrimSearchNotOpen);
  });

  it('should answer 404 for a search that does not exist', async () => {
    const { token } = await createUserWithTeam();

    const res = await request(app)
      .delete('/api/scrims/searches/no-such-search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should go away with the team', async () => {
    const { token } = await createUserWithTeam();
    await open(token, {}).expect(201);

    await request(app).delete('/api/teams/current').set('Authorization', `Bearer ${token}`).expect(200);

    expect(await prisma.scrimSearch.count()).toBe(0);
  });
});
