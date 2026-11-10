// Integration tests - The space of a venue manager: the venues they manage,
// and the divisions of each one's local league as they arrange them, starting
// from the last month drawn on competitive.eva.gg
//
// competitive.eva.gg is never called: the divisions of a month are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { fetchLeagueMonthDivisions } from '../../server/src/integrations/competitive/competitive-teams';

vi.mock('../../server/src/integrations/competitive/competitive-teams', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/competitive/competitive-teams')>(),
  fetchLeagueMonthDivisions: vi.fn(),
}));

const monthDivisions = vi.mocked(fetchLeagueMonthDivisions);

let venuesMade = 0;
async function venue(name = 'Nîmes') {
  venuesMade += 1;
  return prisma.venue.create({ data: { slug: `salle-${venuesMade}`, name, city: name, address: '1 rue du Test' } });
}

let teamsMade = 2444900000000000000n;
async function leagueTeam(name: string) {
  teamsMade += 1n;
  return prisma.leagueTeam.create({
    data: { id: String(teamsMade), name, searchName: name.toLowerCase(), memberCount: 5, seenAt: new Date() },
  });
}

// A signed-in player holding the manager role of these venues, the session switched to it
async function managerOf(...venueIds: string[]) {
  const { user, token } = await createAuthenticatedUser();
  const manager = await prisma.manager.create({ data: {} });
  await prisma.user.update({ where: { id: user.id }, data: { managerId: manager.id } });
  for (const venueId of venueIds) await prisma.venueManager.create({ data: { managerId: manager.id, venueId } });
  await request(app).put('/api/auth/role').set(authHeader(token)).send({ role: 'manager' }).expect(200);
  return { token, managerId: manager.id };
}

function divisionsOf(token: string, venueId: string) {
  return request(app).get(`/api/manager/venues/${venueId}/divisions`).set(authHeader(token));
}

function save(token: string, venueId: string, body: unknown) {
  return request(app).put(`/api/manager/venues/${venueId}/divisions`).set(authHeader(token)).send(body);
}

function read(token: string, venueId: string) {
  return request(app).post(`/api/manager/venues/${venueId}/divisions/read`).set(authHeader(token));
}

beforeEach(() => {
  monthDivisions.mockReset();
});

describe('the space of a venue manager', () => {
  it('lists the venues the manager manages, and is for managers only', async () => {
    const nimes = await venue('Nîmes');
    const avignon = await venue('Avignon');
    await venue('Agen');
    const { token } = await managerOf(nimes.id, avignon.id);

    const res = await request(app).get('/api/manager/venues').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.map((managed: { name: string }) => managed.name)).toEqual(['Avignon', 'Nîmes']);

    const player = await createAuthenticatedUser();
    const refused = await request(app).get('/api/manager/venues').set(authHeader(player.token));
    expect(refused.status).toBe(403);
    expect(refused.body.errors).toContain(ERROR.managerOnly);
    expect((await request(app).get('/api/manager/venues')).status).toBe(401);
  });

  it('opens once the session acts as a manager: each role keeps to its own', async () => {
    const nimes = await venue('Nîmes');
    const { token } = await managerOf(nimes.id);

    await request(app).put('/api/auth/role').set(authHeader(token)).send({ role: 'player' }).expect(200);
    const asPlayer = await request(app).get('/api/manager/venues').set(authHeader(token));
    expect(asPlayer.status).toBe(403);
    expect(asPlayer.body.errors).toContain(ERROR.managerOnly);
    await request(app).put('/api/auth/role').set(authHeader(token)).send({ role: 'manager' }).expect(200);
    expect((await request(app).get('/api/manager/venues').set(authHeader(token))).status).toBe(200);
  });

  it('keeps each venue to its own managers', async () => {
    const nimes = await venue('Nîmes');
    const agen = await venue('Agen');
    const { token } = await managerOf(nimes.id);

    for (const res of [await divisionsOf(token, agen.id), await save(token, agen.id, { divisionCount: 0, places: [] }), await read(token, agen.id)]) {
      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.venueNotManaged);
    }
  });
});

describe('the divisions of a venue\'s league', () => {
  it('saves the divisions whole, each column in its order, and reads them back', async () => {
    const nimes = await venue();
    const { token } = await managerOf(nimes.id);
    const [ronin, api, spartak, nova] = await Promise.all([leagueTeam('RONIN'), leagueTeam('API'), leagueTeam('SPARTAK'), leagueTeam('NOVA')]);

    expect((await divisionsOf(token, nimes.id)).body).toEqual({ venueId: nimes.id, venueName: 'Nîmes', divisionCount: 0, places: [] });

    const saved = await save(token, nimes.id, {
      divisionCount: 2,
      places: [
        { leagueTeamId: spartak.id, division: 2 },
        { leagueTeamId: ronin.id, division: 1 },
        { leagueTeamId: nova.id, division: null },
        { leagueTeamId: api.id, division: 2 },
      ],
    });
    expect(saved.status).toBe(200);

    const read = (await divisionsOf(token, nimes.id)).body;
    expect(read.divisionCount).toBe(2);
    expect(read.places.map((place: { leagueTeam: { name: string }; division: number | null }) => [place.leagueTeam.name, place.division]))
      .toEqual([['RONIN', 1], ['SPARTAK', 2], ['API', 2], ['NOVA', null]]);
    expect(read.places[0].leagueTeam).toMatchObject({ id: ronin.id, logoUrl: null, team: null });

    await save(token, nimes.id, { divisionCount: 1, places: [{ leagueTeamId: ronin.id, division: 1 }] }).expect(200);
    expect((await divisionsOf(token, nimes.id)).body.places).toHaveLength(1);
  });

  it('refuses divisions that do not hold together, and a team placed at another venue', async () => {
    const nimes = await venue('Nîmes');
    const agen = await venue('Agen');
    const { token } = await managerOf(nimes.id);
    const other = await managerOf(agen.id);
    const ronin = await leagueTeam('RONIN');

    for (const body of [
      { divisionCount: 9, places: [] },
      { divisionCount: 1, places: [{ leagueTeamId: ronin.id, division: 2 }] },
      { divisionCount: 1, places: [{ leagueTeamId: ronin.id, division: 1 }, { leagueTeamId: ronin.id, division: null }] },
      { divisionCount: '2', places: [] },
    ]) {
      const res = await save(token, nimes.id, body);
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.divisionsInvalid);
    }
    const unknown = await save(token, nimes.id, { divisionCount: 1, places: [{ leagueTeamId: '999', division: 1 }] });
    expect(unknown.body.errors).toContain(ERROR.divisionsTeamUnknown);

    await save(other.token, agen.id, { divisionCount: 1, places: [{ leagueTeamId: ronin.id, division: 1 }] }).expect(200);
    const elsewhere = await save(token, nimes.id, { divisionCount: 1, places: [{ leagueTeamId: ronin.id, division: 1 }] });
    expect(elsewhere.status).toBe(400);
    expect(elsewhere.body.errors).toContain(ERROR.divisionsTeamElsewhere);
  });

  it('starts from the last month drawn on the site, without saving it', async () => {
    const nimes = await venue();
    const { token } = await managerOf(nimes.id);
    const [ronin, api, spartak] = await Promise.all([leagueTeam('RONIN'), leagueTeam('API'), leagueTeam('SPARTAK')]);
    await prisma.leagueTournament.createMany({
      data: [
        { id: '2566158648169035775', name: 'NEMAUSUS LEAGUE - OCTOBRE', regionId: 'r', venueId: nimes.id, registrationClosesAt: new Date('2020-10-25T23:00:00Z'), seenAt: new Date() },
        { id: '2566158808867510271', name: 'NEMAUSUS LEAGUE - NOVEMBRE', regionId: 'r', venueId: nimes.id, registrationClosesAt: new Date('2099-11-29T23:00:00Z'), seenAt: new Date() },
      ],
    });
    monthDivisions.mockResolvedValue([
      { number: 1, name: 'Division 1', leagueTeamIds: [spartak.id] },
      { number: 2, name: 'Division 2', leagueTeamIds: [ronin.id, api.id, '9999999999999999999'] },
    ]);

    const res = await read(token, nimes.id);

    expect(res.status).toBe(200);
    expect(monthDivisions).toHaveBeenCalledWith('2566158648169035775');
    expect(res.body.tournamentName).toBe('NEMAUSUS LEAGUE - OCTOBRE');
    expect(res.body.divisionCount).toBe(2);
    expect(res.body.places.map((place: { leagueTeam: { name: string }; division: number }) => [place.leagueTeam.name, place.division]))
      .toEqual([['SPARTAK', 1], ['API', 2], ['RONIN', 2]]);
    expect((await divisionsOf(token, nimes.id)).body.places).toEqual([]);

    const again = await read(token, nimes.id);
    expect(again.status).toBe(429);
    expect(again.body.errors).toContain(ERROR.divisionsReadTooSoon);
  });

  it('says when no month of the league is known yet, or the last one is not drawn', async () => {
    const nimes = await venue();
    const avignon = await venue('Avignon');
    const { token } = await managerOf(nimes.id, avignon.id);

    const unknown = await read(token, nimes.id);
    expect(unknown.status).toBe(404);
    expect(unknown.body.errors).toContain(ERROR.divisionsMonthUnknown);

    await prisma.leagueTournament.create({
      data: { id: '2566158648169035776', name: 'AVIGNON - OCTOBRE', regionId: 'a', venueId: avignon.id, registrationClosesAt: new Date('2020-10-25T23:00:00Z'), seenAt: new Date() },
    });
    monthDivisions.mockResolvedValue([]);
    const notDrawn = await read(token, avignon.id);
    expect(notDrawn.status).toBe(404);
    expect(notDrawn.body.errors).toContain(ERROR.divisionsMonthNotDrawn);
  });
});
