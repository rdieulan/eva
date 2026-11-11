// Integration tests - The calendar of a venue, as its manager reads it: the
// competitions and the events it publishes, and the matches teams play there
// on eva.gg slots, once each, the matchmaking's and those entered by hand

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';

let venuesMade = 0;
async function venue() {
  venuesMade += 1;
  return prisma.venue.create({ data: { slug: `salle-k-${venuesMade}`, name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test' } });
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

// A team of the app, by name
async function team(name: string) {
  const leader = await createUserWithTeam();
  await prisma.team.update({ where: { id: leader.team.id }, data: { name } });
  return { id: leader.team.id, playerId: leader.user.playerId };
}

// A match in a team's calendar, on the slots given: none, a match the venue cannot see
function match(owner: { id: string; playerId: string }, venueId: string, fields: { date: string; title: string; evaSlotIds: string[]; scrimSearchId?: string }) {
  return prisma.calendarEvent.create({
    data: {
      type: 'MATCH', teamId: owner.id, createdById: owner.playerId, venueId, arenaNumber: 1,
      date: new Date(fields.date), startTime: '20:00', endTime: '21:20', title: fields.title,
      evaSlotIds: fields.evaSlotIds, scrimSearchId: fields.scrimSearchId ?? null,
    },
  });
}

// A month far from now: the venue publishes there directly, whatever the day the tests run
const MONTH = '2031-03';

function calendar(token: string, venueId: string, month = MONTH) {
  return request(app).get(`/api/manager/venues/${venueId}/calendar?month=${month}`).set(authHeader(token));
}

describe('the calendar of a venue', () => {
  it('shows the competitions and the events of its month, by day and hour, with what came of them', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    await prisma.venueCompetition.create({
      data: { venueId: nimes.id, division: 2, title: 'Journée de la Division 2', date: new Date('2031-03-14'), startTime: '14:00', endTime: '19:00' },
    });
    await prisma.venueEvent.createMany({
      data: [
        { venueId: nimes.id, title: 'Nocturne', date: new Date('2031-03-14'), startTime: '21:00', endTime: '23:59', description: 'Ouverte à tous' },
        { venueId: nimes.id, title: 'Soirée', date: new Date('2031-03-02'), startTime: '19:00', endTime: '22:00' },
        { venueId: nimes.id, title: 'Le mois suivant', date: new Date('2031-04-01'), startTime: '19:00', endTime: '22:00' },
      ],
    });

    const month = await calendar(token, nimes.id);

    expect(month.status).toBe(200);
    expect(month.body.map((item: { type: string; title: string; date: string }) => [item.date, item.type, item.title])).toEqual([
      ['2031-03-02', 'EVENT', 'Soirée'],
      ['2031-03-14', 'COMPETITION', 'Journée de la Division 2'],
      ['2031-03-14', 'EVENT', 'Nocturne'],
    ]);
    expect(month.body[1]).toMatchObject({ division: 2, answers: { pending: 0, accepted: 0, refused: 0 } });
    expect(month.body[2]).toMatchObject({ venueName: 'Nîmes', description: 'Ouverte à tous', teamsAdding: 0 });
  });

  it('shows a match on the same slots once, with both its teams, however it was entered', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const rivals = await team('Les Rivaux');
    const calm = await team('Calme Plat');
    const search = await prisma.scrimSearch.create({
      data: { teamId: rivals.id, createdById: rivals.playerId, date: new Date('2031-03-10'), startTime: '20:00', endTime: '21:20', convocationTime: '19:50', status: 'MATCHED' },
    });
    // The matchmaking puts it in both calendars
    await match(rivals, nimes.id, { date: '2031-03-10', title: 'Scrim vs Calme Plat', evaSlotIds: ['a-20', 'a-20h40'], scrimSearchId: search.id });
    await match(calm, nimes.id, { date: '2031-03-10', title: 'Scrim vs Les Rivaux', evaSlotIds: ['a-20', 'a-20h40'], scrimSearchId: search.id });
    // Each team entered this one by hand, on the same slots, in its own order
    const first = await match(calm, nimes.id, { date: '2031-03-12', title: 'Revanche', evaSlotIds: ['b-21', 'b-21h40'] });
    await match(rivals, nimes.id, { date: '2031-03-12', title: 'Match retour', evaSlotIds: ['b-21h40', 'b-21'] });

    const month = await calendar(token, nimes.id);

    expect(month.body).toEqual([
      {
        type: 'MATCH', id: expect.any(String), date: '2031-03-10', startTime: '20:00', endTime: '21:20', title: 'Calme Plat vs Les Rivaux',
        arenaNumber: 1, slotCount: 2, fromMatchmaking: true,
        teams: [{ id: calm.id, name: 'Calme Plat', logoUrl: null }, { id: rivals.id, name: 'Les Rivaux', logoUrl: null }],
      },
      expect.objectContaining({ type: 'MATCH', id: first.id, date: '2031-03-12', title: 'Calme Plat vs Les Rivaux', fromMatchmaking: false }),
    ]);
  });

  it('shows a match one team entered alone with its own words, and leaves out a match without slots or elsewhere', async () => {
    const nimes = await venue();
    const elsewhere = await venue();
    const token = await managerOf(nimes.id);
    const calm = await team('Calme Plat');
    await match(calm, nimes.id, { date: '2031-03-20', title: 'Scrim vs Les Loups', evaSlotIds: ['c-20', 'c-20h40'] });
    await match(calm, nimes.id, { date: '2031-03-21', title: 'Sans créneau', evaSlotIds: [] });
    await match(calm, elsewhere.id, { date: '2031-03-22', title: 'Ailleurs', evaSlotIds: ['d-20'] });

    const month = await calendar(token, nimes.id);

    expect(month.body.map((item: { title: string }) => item.title)).toEqual(['Calme Plat · Scrim vs Les Loups']);
    expect(month.body[0]).toMatchObject({ teams: [{ id: calm.id, name: 'Calme Plat', logoUrl: null }], fromMatchmaking: false });
  });

  it('opens to the manager of the venue only, for a month', async () => {
    const nimes = await venue();
    const other = await venue();
    const token = await managerOf(other.id);

    const refused = await calendar(token, nimes.id);
    expect(refused.status).toBe(403);
    expect(refused.body.errors).toContain(ERROR.venueNotManaged);

    const noMonth = await calendar(await managerOf(nimes.id), nimes.id, 'mars');
    expect(noMonth.status).toBe(400);
    expect(noMonth.body.errors).toContain(ERROR.monthParamRequired);
  });
});
