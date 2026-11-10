// Integration tests - The competitions a venue's manager publishes in the
// venue's calendar: the days of a division of its league, and the events of
// the venue's own

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser, createTeamMember, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { shiftDay, toParisTime } from '@shared/utils/date.utils';

let venuesMade = 0;
async function venue(divisions = 3) {
  venuesMade += 1;
  return prisma.venue.create({
    data: { slug: `salle-c-${venuesMade}`, name: `Salle ${venuesMade}`, city: 'Nîmes', address: '1 rue du Test', leagueDivisionCount: divisions },
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

const today = toParisTime(new Date()).day;

function publish(token: string, venueId: string, body: Record<string, unknown>) {
  return request(app).post(`/api/manager/venues/${venueId}/competitions`).set(authHeader(token)).send(body);
}

describe('the competitions of a venue', () => {
  it('publishes the days of a division and the events of the venue, the soonest first', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);

    const night = await publish(token, nimes.id, { division: null, title: 'Nocturne', date: shiftDay(today, 9), startTime: '21:00', endTime: '23:59', description: 'Ouverte à tous' });
    const day = await publish(token, nimes.id, { division: 2, title: ' Journée de la Division 2 ', date: shiftDay(today, 3), startTime: '14:00', endTime: '19:00' });

    expect(night.status).toBe(201);
    expect(day.status).toBe(201);
    expect(day.body).toEqual({
      id: expect.any(String), division: 2, title: 'Journée de la Division 2', date: shiftDay(today, 3), startTime: '14:00', endTime: '19:00', description: null,
      answers: { pending: 0, accepted: 0, refused: 0 },
    });
    const listed = await request(app).get(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token));
    expect(listed.body.map((competition: { title: string }) => competition.title)).toEqual(['Journée de la Division 2', 'Nocturne']);
  });

  it('refuses a competition without a title, in the past, with hours the wrong way, or of a division the league has not', async () => {
    const nimes = await venue(2);
    const token = await managerOf(nimes.id);
    const valid = { division: null, title: 'Tournoi', date: shiftDay(today, 1), startTime: '14:00', endTime: '18:00' };

    for (const body of [{ ...valid, title: '  ' }, { ...valid, date: shiftDay(today, -1) }, { ...valid, endTime: '13:00' }, { ...valid, date: '2026-02-31' }]) {
      const res = await publish(token, nimes.id, body);
      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.competitionInvalid);
    }
    const division = await publish(token, nimes.id, { ...valid, division: 3 });
    expect(division.status).toBe(400);
    expect(division.body.errors).toContain(ERROR.competitionDivisionInvalid);
  });

  it('withdraws a competition, only from its own venue', async () => {
    const nimes = await venue();
    const agen = await venue();
    const token = await managerOf(nimes.id);
    const other = await managerOf(agen.id);
    const published = await publish(token, nimes.id, { division: 1, title: 'Journée de la Division 1', date: today, startTime: '20:00', endTime: '23:00' });

    expect((await request(app).delete(`/api/manager/venues/${agen.id}/competitions/${published.body.id}`).set(authHeader(other))).status).toBe(404);
    expect((await request(app).delete(`/api/manager/venues/${nimes.id}/competitions/${published.body.id}`).set(authHeader(token))).status).toBe(204);
    expect((await request(app).get(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token))).body).toEqual([]);
  });
});

describe('the competitions offered to the teams', () => {
  let leagueTeamsMade = 2445900000000000000n;

  // A team of ours whose league team the manager placed in a division of the venue
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

  function dashboardOf(token: string) {
    return request(app).get('/api/dashboard').set(authHeader(token));
  }

  it("offers a division's day to the teams of that division, an event of the venue to all its teams", async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const second = await teamInDivision(nimes.id, 2);
    const first = await teamInDivision(nimes.id, 1);
    const affiliated = await createUserWithTeam();
    await prisma.team.update({ where: { id: affiliated.team.id }, data: { venueId: nimes.id } });

    const day = await publish(token, nimes.id, { division: 2, title: 'Journée de la Division 2', date: shiftDay(today, 3), startTime: '14:00', endTime: '19:00' });
    const night = await publish(token, nimes.id, { division: null, title: 'Nocturne', date: shiftDay(today, 5), startTime: '21:00', endTime: '23:59' });

    expect(day.body.answers).toEqual({ pending: 1, accepted: 0, refused: 0 });
    expect(night.body.answers).toEqual({ pending: 3, accepted: 0, refused: 0 });
    const offersOf = async (reader: { token: string }) => (await dashboardOf(reader.token)).body.items
      .filter((item: { kind: string }) => item.kind === 'COMPETITION_OFFER')
      .map((item: { data: { title: string } }) => item.data.title);
    expect(await offersOf(second)).toEqual(['Journée de la Division 2', 'Nocturne']);
    expect(await offersOf(first)).toEqual(['Nocturne']);
    expect(await offersOf(affiliated)).toEqual(['Nocturne']);
    const offer = (await dashboardOf(second.token)).body.items.find((item: { kind: string }) => item.kind === 'COMPETITION_OFFER');
    expect(offer).toMatchObject({ due: `${shiftDay(today, 3)}T14:00`, data: { venueName: nimes.name, division: 2, startTime: '14:00', endTime: '19:00' } });
  });

  it("adds an accepted competition to the team's calendar, once, and lets those who cannot create events see none", async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const leader = await teamInDivision(nimes.id, 2);
    const member = await createTeamMember(leader.token, leader.team.id);
    const day = await publish(token, nimes.id, { division: 2, title: 'Journée de la Division 2', date: shiftDay(today, 3), startTime: '14:00', endTime: '19:00', description: 'Convocation 13:30' });

    expect((await dashboardOf(member.token)).body.items.some((item: { kind: string }) => item.kind === 'COMPETITION_OFFER')).toBe(false);
    expect((await request(app).post(`/api/dashboard/competition-offers/${day.body.id}/accept`).set(authHeader(member.token))).status).toBe(403);

    const accepted = await request(app).post(`/api/dashboard/competition-offers/${day.body.id}/accept`).set(authHeader(leader.token));
    expect(accepted.status).toBe(200);
    const event = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: accepted.body.eventId } });
    expect(event).toMatchObject({ type: 'COMPETITION', title: 'Journée de la Division 2', teamId: leader.team.id, startTime: '14:00', endTime: '19:00', description: 'Convocation 13:30', venueCompetitionId: day.body.id });

    const again = await request(app).post(`/api/dashboard/competition-offers/${day.body.id}/refuse`).set(authHeader(leader.token));
    expect(again.status).toBe(404);
    expect(again.body.errors).toContain(ERROR.competitionOfferNotFound);
    expect((await dashboardOf(leader.token)).body.items.some((item: { kind: string }) => item.kind === 'COMPETITION_OFFER')).toBe(false);
    const listed = await request(app).get(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token));
    expect(listed.body[0].answers).toEqual({ pending: 0, accepted: 1, refused: 0 });

    // Withdrawn by the venue, the team's copy goes with it
    await request(app).delete(`/api/manager/venues/${nimes.id}/competitions/${day.body.id}`).set(authHeader(token)).expect(204);
    expect(await prisma.calendarEvent.findUnique({ where: { id: accepted.body.eventId } })).toBeNull();
  });

  it('refuses a competition: nothing joins the calendar', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const leader = await teamInDivision(nimes.id, 1);
    const day = await publish(token, nimes.id, { division: 1, title: 'Journée de la Division 1', date: shiftDay(today, 2), startTime: '14:00', endTime: '19:00' });

    const refused = await request(app).post(`/api/dashboard/competition-offers/${day.body.id}/refuse`).set(authHeader(leader.token));

    expect(refused.status).toBe(200);
    expect(refused.body).toEqual({ eventId: null });
    expect(await prisma.calendarEvent.count({ where: { teamId: leader.team.id, type: 'COMPETITION' } })).toBe(0);
  });
});
