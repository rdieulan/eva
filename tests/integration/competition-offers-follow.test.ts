// Integration tests - The competitions of a venue follow the teams they are
// for: a team placed in a division, affiliated to the venue, linked to its
// league team or arrived on the app after a competition was published gets
// it; a team no longer concerned loses the offer it had not answered, never
// what it answered
//
// competitive.eva.gg is never called: the list and the tournaments are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { shiftDay, toParisTime } from '@shared/utils/date.utils';
import { fetchLeagueTeamTournaments, fetchLeagueTeamsPage } from '../../server/src/integrations/competitive/competitive-teams';
import { syncLeagueDirectory } from '../../server/src/services/league-directory.service';

vi.mock('../../server/src/integrations/competitive/competitive-teams', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/integrations/competitive/competitive-teams')>(),
  fetchLeagueTeamsPage: vi.fn(),
  fetchLeagueTeamTournaments: vi.fn(),
}));

const listPage = vi.mocked(fetchLeagueTeamsPage);

let venuesMade = 0;
async function venue() {
  venuesMade += 1;
  return prisma.venue.create({
    data: { slug: `salle-f-${venuesMade}`, name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test', leagueDivisionCount: 3 },
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

let leagueTeamsMade = 2446900000000000000n;
async function leagueTeam() {
  leagueTeamsMade += 1n;
  return prisma.leagueTeam.create({
    data: { id: String(leagueTeamsMade), name: `League ${leagueTeamsMade}`, searchName: 'league', memberCount: 4, seenAt: new Date() },
  });
}

const today = toParisTime(new Date()).day;

function publish(token: string, venueId: string, division: number | null, title: string) {
  return request(app).post(`/api/manager/venues/${venueId}/competitions`).set(authHeader(token))
    .send({ division, title, date: shiftDay(today, 3), startTime: '14:00', endTime: '19:00' })
    .expect(201);
}

function placeTeams(token: string, venueId: string, places: { leagueTeamId: string; division: number | null }[]) {
  return request(app).put(`/api/manager/venues/${venueId}/divisions`).set(authHeader(token)).send({ divisionCount: 3, places }).expect(200);
}

// The competitions a team has to answer, by title, as its home lists them
async function offersOf(token: string) {
  const items = (await request(app).get('/api/dashboard').set(authHeader(token)).expect(200)).body.items;
  return items.filter((item: { kind: string }) => item.kind === 'COMPETITION_OFFER').map((item: { data: { title: string } }) => item.data.title);
}

async function toldOf(token: string) {
  const notifications = (await request(app).get('/api/notifications').set(authHeader(token)).expect(200)).body.notifications;
  return notifications.map((notification: { kind: string }) => notification.kind);
}

beforeEach(() => {
  listPage.mockReset();
  vi.mocked(fetchLeagueTeamTournaments).mockReset().mockResolvedValue([]);
});

describe('the competitions of a venue follow its teams', () => {
  it('offers a division\'s day to a team placed in the division after it was published, and tells it', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const league = await leagueTeam();
    const leader = await createUserWithTeam();
    await prisma.team.update({ where: { id: leader.team.id }, data: { leagueTeamId: league.id } });
    await publish(token, nimes.id, 2, 'Journée de la Division 2');
    expect(await offersOf(leader.token)).toEqual([]);

    await placeTeams(token, nimes.id, [{ leagueTeamId: league.id, division: 2 }]);

    expect(await offersOf(leader.token)).toEqual(['Journée de la Division 2']);
    expect(await toldOf(leader.token)).toEqual(['COMPETITION_OFFERED']);
  });

  it('takes back an unanswered offer from a team moved to another division, never an answered one', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const [answered, waiting] = [await leagueTeam(), await leagueTeam()];
    const accepting = await createUserWithTeam();
    const silent = await createUserWithTeam();
    await prisma.team.update({ where: { id: accepting.team.id }, data: { leagueTeamId: answered.id } });
    await prisma.team.update({ where: { id: silent.team.id }, data: { leagueTeamId: waiting.id } });
    await placeTeams(token, nimes.id, [{ leagueTeamId: answered.id, division: 2 }, { leagueTeamId: waiting.id, division: 2 }]);
    const second = await publish(token, nimes.id, 2, 'Journée de la Division 2');
    await publish(token, nimes.id, 3, 'Journée de la Division 3');
    await request(app).post(`/api/dashboard/competition-offers/${second.body.id}/accept`).set(authHeader(accepting.token)).expect(200);

    await placeTeams(token, nimes.id, [{ leagueTeamId: answered.id, division: 3 }, { leagueTeamId: waiting.id, division: 3 }]);

    expect(await offersOf(silent.token)).toEqual(['Journée de la Division 3']);
    expect(await offersOf(accepting.token)).toEqual(['Journée de la Division 3']);
    // The day it accepted stays in its calendar
    expect(await prisma.calendarEvent.count({ where: { teamId: accepting.team.id, venueCompetitionId: second.body.id } })).toBe(1);
    const listed = await request(app).get(`/api/manager/venues/${nimes.id}/competitions`).set(authHeader(token));
    const answers = Object.fromEntries(listed.body.map((competition: { title: string; answers: unknown }) => [competition.title, competition.answers]));
    expect(answers).toEqual({
      'Journée de la Division 2': { pending: 0, accepted: 1, refused: 0 },
      'Journée de la Division 3': { pending: 2, accepted: 0, refused: 0 },
    });
  });

  it('offers a tournament to a team affiliated to the venue afterwards, and takes it back when it leaves', async () => {
    const nimes = await venue();
    const agen = await venue();
    const token = await managerOf(nimes.id);
    const leader = await createUserWithTeam();
    await publish(token, nimes.id, null, 'Tournoi 2v2');

    await request(app).put('/api/teams/current').set(authHeader(leader.token)).send({ venueId: nimes.id }).expect(200);
    expect(await offersOf(leader.token)).toEqual(['Tournoi 2v2']);

    await request(app).put('/api/teams/current').set(authHeader(leader.token)).send({ venueId: agen.id }).expect(200);
    expect(await offersOf(leader.token)).toEqual([]);
  });

  it('follows a team linking its league team, then unlinking it', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const league = await leagueTeam();
    await placeTeams(token, nimes.id, [{ leagueTeamId: league.id, division: 1 }]);
    await publish(token, nimes.id, 1, 'Journée de la Division 1');
    const leader = await createUserWithTeam();

    await request(app).put('/api/teams/current/league-team').set(authHeader(leader.token)).send({ leagueTeamId: league.id }).expect(200);
    expect(await offersOf(leader.token)).toEqual(['Journée de la Division 1']);

    await request(app).put('/api/teams/current/league-team').set(authHeader(leader.token)).send({ leagueTeamId: null }).expect(200);
    expect(await offersOf(leader.token)).toEqual([]);
  });

  it('offers the competitions already published to a team made from a league team placed at the venue', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const league = await leagueTeam();
    await placeTeams(token, nimes.id, [{ leagueTeamId: league.id, division: 2 }]);
    await publish(token, nimes.id, 2, 'Journée de la Division 2');
    const { token: founder } = await createAuthenticatedUser();

    await request(app).post('/api/teams').set(authHeader(founder)).send({ name: 'RONIN', leagueTeamId: league.id }).expect(201);

    expect(await offersOf(founder)).toEqual(['Journée de la Division 2']);
  });

  it('takes the division\'s days back from the team of a league team gone from the directory', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const league = await leagueTeam();
    const leader = await createUserWithTeam();
    await prisma.team.update({ where: { id: leader.team.id }, data: { leagueTeamId: league.id } });
    await placeTeams(token, nimes.id, [{ leagueTeamId: league.id, division: 2 }]);
    await publish(token, nimes.id, 2, 'Journée de la Division 2');
    expect(await offersOf(leader.token)).toEqual(['Journée de la Division 2']);

    // Missing from the list for more than a week
    await prisma.leagueTeam.update({ where: { id: league.id }, data: { seenAt: new Date(Date.now() - 9 * 24 * 3600 * 1000) } });
    listPage.mockResolvedValue({ teams: [], skipped: 0, total: 0 });
    await syncLeagueDirectory({ pauseMs: 0 });

    expect(await offersOf(leader.token)).toEqual([]);
  });
});
