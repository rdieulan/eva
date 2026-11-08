// Integration tests - The public board of a venue: its open searches to come, readable without an account
//
// eva.gg is never called: the sessions lookup is mocked so searches can open,
// and the board itself reads none.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { fetchLocationSessions } from '../../server/src/integrations/eva/eva-sessions';
import { clearVenueSlotsCache } from '../../server/src/services/venue-slots.service';

vi.mock('../../server/src/integrations/eva/eva-sessions', () => ({
  fetchLocationSessions: vi.fn(),
}));

const sessions = vi.mocked(fetchLocationSessions);

const NIMES = { id: 'venue-nimes', slug: 'nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue', externalId: 51, arenaCount: 2 };
const MONTPELLIER = { id: 'venue-montpellier', slug: 'montpellier', name: 'Montpellier', city: 'Montpellier', address: '3 rue', externalId: 52, arenaCount: 1 };
const DATE = '2030-06-10';
const LATER = '2030-06-12';

function slot(slotId: string, startTime: string, endTime: string, arenaNumber = 1) {
  return { slotId, startTime, endTime, convocationTime: startTime, arenaNumber, gameId: 1, takenSeats: 0, totalSeats: 10, isCompetitiveAvailable: true };
}

// The evening on arena 1 of Nîmes, arena 2 from 20:00; two slots in Montpellier
const NIMES_SLOTS = [
  slot('a1-1920', '19:20', '20:00'),
  slot('a1-2000', '20:00', '20:40'),
  slot('a1-2040', '20:40', '21:20'),
  slot('a1-2120', '21:20', '22:00'),
  slot('a2-2000', '20:00', '20:40', 2),
  slot('a2-2040', '20:40', '21:20', 2),
];
const MONTPELLIER_SLOTS = [slot('m1-2000', '20:00', '20:40'), slot('m1-2040', '20:40', '21:20')];

const atNimes = (...evaSlotIds: string[]) => ({ venueId: NIMES.id, evaSlotIds });
const atMontpellier = (...evaSlotIds: string[]) => ({ venueId: MONTPELLIER.id, evaSlotIds });

beforeEach(async () => {
  sessions.mockReset();
  sessions.mockImplementation(async externalId => (externalId === MONTPELLIER.externalId ? MONTPELLIER_SLOTS : NIMES_SLOTS));
  clearVenueSlotsCache();
  await prisma.venue.createMany({ data: [NIMES, MONTPELLIER] });
});

async function openSearch(token: string, body: Record<string, unknown>): Promise<string> {
  const res = await request(app)
    .post('/api/scrims/searches')
    .set('Authorization', `Bearer ${token}`)
    .send({ date: DATE, slotCount: 2, matchCount: 1, ...body })
    .expect(201);
  return res.body.id;
}

function board(slug: string) {
  return request(app).get(`/api/public/venues/${slug}/board`);
}

describe('GET /api/public/venues/:slug/board', () => {
  it('lets anyone read the open searches to come in a venue, day by day, without an account', async () => {
    const early = await createUserWithTeam();
    const late = await createUserWithTeam();
    const later = await createUserWithTeam();
    const lateId = await openSearch(late.token, { venues: [atNimes('a1-2040', 'a1-2120')] });
    const earlyId = await openSearch(early.token, { venues: [atNimes('a1-1920', 'a1-2000')] });
    const laterId = await openSearch(later.token, { date: LATER, venues: [atNimes('a2-2000', 'a2-2040')] });

    const res = await board('nimes');

    expect(res.status).toBe(200);
    expect(res.body.venue).toEqual({ id: NIMES.id, slug: 'nimes', name: 'Nîmes', arenaCount: 2 });
    expect(res.body.searches.map((search: { id: string }) => search.id)).toEqual([earlyId, lateId, laterId]);
    expect(res.body.searches[0]).toEqual({
      id: earlyId,
      date: DATE,
      team: { id: early.team.id, name: early.team.name, logoUrl: null },
      ranges: [{ arenaNumber: 1, startTime: '19:20', endTime: '20:40' }],
      slotCount: 2,
      matchCount: 1,
      matchedCount: 0,
    });
    expect(res.body.searches[2]).toMatchObject({ date: LATER, ranges: [{ arenaNumber: 2, startTime: '20:00', endTime: '21:20' }] });
  });

  it('shows only the stretches of that venue where a match still fits, out of the times of the matches made', async () => {
    const searcher = await createUserWithTeam();
    const opponent = await createUserWithTeam();
    const searchId = await openSearch(searcher.token, {
      venues: [atNimes('a1-1920', 'a1-2000', 'a1-2040', 'a1-2120', 'a2-2000', 'a2-2040'), atMontpellier('m1-2000', 'm1-2040')],
      matchCount: 2,
    });
    // 19:20 to 20:40: arena 2 at 20:00 is taken by the time, 20:40 is left alone on it
    const proposal = await request(app)
      .post(`/api/scrims/searches/${searchId}/proposals`)
      .set('Authorization', `Bearer ${opponent.token}`)
      .send({ evaSlotIds: ['a1-1920', 'a1-2000'] })
      .expect(201);
    await request(app).put(`/api/scrims/proposals/${proposal.body.id}/accept`).set('Authorization', `Bearer ${searcher.token}`).expect(200);

    const nimes = (await board('nimes')).body.searches;
    expect(nimes).toHaveLength(1);
    expect(nimes[0]).toMatchObject({ matchCount: 2, matchedCount: 1, ranges: [{ arenaNumber: 1, startTime: '20:40', endTime: '22:00' }] });

    // Its only run in Montpellier starts before the match ends: a team plays one match at a time
    expect((await board('montpellier')).body.searches).toEqual([]);
  });

  it('leaves out a search nothing can be proposed on there: too few slots in a row, closed, or of a day gone by', async () => {
    const tooShort = await createUserWithTeam();
    const closed = await createUserWithTeam();
    const gone = await createUserWithTeam();
    const elsewhere = await openSearch(tooShort.token, { venues: [atNimes('a1-1920'), atMontpellier('m1-2000', 'm1-2040')] });
    const closedId = await openSearch(closed.token, { venues: [atNimes('a1-2000', 'a1-2040')] });
    await prisma.scrimSearch.update({ where: { id: closedId }, data: { status: 'MATCHED' } });
    const goneId = await openSearch(gone.token, { venues: [atNimes('a1-2040', 'a1-2120')] });
    await prisma.scrimSearch.update({ where: { id: goneId }, data: { date: new Date('2020-01-10') } });

    expect((await board('nimes')).body.searches).toEqual([]);
    expect((await board('montpellier')).body.searches.map((search: { id: string }) => search.id)).toEqual([elsewhere]);
  });

  it('tells nothing of who answered: no proposal, no player', async () => {
    const searcher = await createUserWithTeam();
    const opponent = await createUserWithTeam();
    const searchId = await openSearch(searcher.token, { venues: [atNimes('a1-1920', 'a1-2000', 'a1-2040', 'a1-2120')] });
    await request(app)
      .post(`/api/scrims/searches/${searchId}/proposals`)
      .set('Authorization', `Bearer ${opponent.token}`)
      .send({ evaSlotIds: ['a1-2040', 'a1-2120'], message: 'On est chauds' })
      .expect(201);

    const [search] = (await board('nimes')).body.searches;
    expect(Object.keys(search).sort()).toEqual(['date', 'id', 'matchCount', 'matchedCount', 'ranges', 'slotCount', 'team']);
    expect(Object.keys(search.team).sort()).toEqual(['id', 'logoUrl', 'name']);
  });

  it('says a venue it does not know', async () => {
    const res = await board('nulle-part');

    expect(res.status).toBe(404);
    expect(res.body.errors).toContain(ERROR.venueNotFound);
  });

  it('never asks eva.gg', async () => {
    const searcher = await createUserWithTeam();
    await openSearch(searcher.token, { venues: [atNimes('a1-2000', 'a1-2040')] });
    sessions.mockClear();

    await board('nimes').expect(200);

    expect(sessions).not.toHaveBeenCalled();
  });
});
