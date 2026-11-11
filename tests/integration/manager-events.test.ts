// Integration tests - The events a venue's manager publishes in the venue's
// calendar, open to all: offered to no team, seen in the calendar of the teams
// whose venue it is, added there by those who make the team's events, and
// gone from it, the team told, when the venue withdraws them

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader, createAuthenticatedUser, createTeamMember, createUserWithTeam } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { shiftDay, toParisTime } from '@shared/utils/date.utils';

let venuesMade = 0;
async function venue() {
  venuesMade += 1;
  return prisma.venue.create({ data: { slug: `salle-e-${venuesMade}`, name: 'Nîmes', city: 'Nîmes', address: '1 rue du Test' } });
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

// A team whose venue it is, by its leader
async function teamOf(venueId: string) {
  const leader = await createUserWithTeam();
  await prisma.team.update({ where: { id: leader.team.id }, data: { venueId } });
  return leader;
}

const today = toParisTime(new Date()).day;
const DAY = shiftDay(today, 4);
const NIGHT = { title: 'Nocturne', date: DAY, startTime: '21:00', endTime: '23:59', description: 'Ouverte à tous' };

function publish(token: string, venueId: string, body: Record<string, unknown>) {
  return request(app).post(`/api/manager/venues/${venueId}/events`).set(authHeader(token)).send(body);
}

function add(token: string, eventId: string) {
  return request(app).post(`/api/calendar/venue-events/${eventId}/add`).set(authHeader(token));
}

async function dayOf(token: string, date: string) {
  const month = await request(app).get(`/api/calendar/availability?month=${date.slice(0, 7)}`).set(authHeader(token)).expect(200);
  return month.body.days[date];
}

describe('the events of a venue', () => {
  it('publishes an event open to all, offered to no team, and refuses one that does not hold together', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);

    const published = await publish(token, nimes.id, NIGHT);

    expect(published.status).toBe(201);
    expect(published.body).toEqual({ id: expect.any(String), venueName: 'Nîmes', ...NIGHT, teamsAdding: 0 });
    expect(await prisma.notification.count()).toBe(0);
    const listed = await request(app).get(`/api/manager/venues/${nimes.id}/events`).set(authHeader(token));
    expect(listed.body.map((event: { title: string }) => event.title)).toEqual(['Nocturne']);

    for (const body of [{ ...NIGHT, title: ' ' }, { ...NIGHT, date: shiftDay(today, -1) }, { ...NIGHT, endTime: '20:00' }]) {
      const refused = await publish(token, nimes.id, body);
      expect(refused.status).toBe(400);
      expect(refused.body.errors).toContain(ERROR.publicationInvalid);
    }
  });

  it('shows the event, not taken yet, in the calendar of the teams whose venue it is only', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const home = await teamOf(nimes.id);
    const elsewhere = await teamOf((await venue()).id);

    const published = await publish(token, nimes.id, NIGHT);

    expect((await dayOf(home.token, DAY)).venueEvents).toEqual([{ id: published.body.id, venueName: 'Nîmes', ...NIGHT }]);
    expect((await dayOf(elsewhere.token, DAY)).venueEvents).toEqual([]);
  });

  it('adds the event to the team\'s calendar once, by those who make its events, as the team\'s own copy', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const leader = await teamOf(nimes.id);
    const member = await createTeamMember(leader.token, leader.team.id);
    const published = await publish(token, nimes.id, NIGHT);

    expect((await add(member.token, published.body.id)).status).toBe(403);
    const added = await add(leader.token, published.body.id);

    expect(added.status).toBe(201);
    const day = await dayOf(leader.token, DAY);
    expect(day.venueEvents).toEqual([]);
    expect(day.events).toEqual([expect.objectContaining({ id: added.body.eventId, type: 'EVENT', title: 'Nocturne', startTime: '21:00' })]);
    const again = await add(leader.token, published.body.id);
    expect(again.status).toBe(409);
    expect(again.body.errors).toContain(ERROR.venueEventAlreadyAdded);
    const listed = await request(app).get(`/api/manager/venues/${nimes.id}/events`).set(authHeader(token));
    expect(listed.body[0].teamsAdding).toBe(1);
  });

  it('leaves an event whose day has gone by out of the calendar, and refuses to add it', async () => {
    const nimes = await venue();
    const leader = await teamOf(nimes.id);
    const yesterday = shiftDay(today, -1);
    // Published while it was to come
    const gone = await prisma.venueEvent.create({
      data: { venueId: nimes.id, title: 'Nocturne', date: new Date(yesterday), startTime: '21:00', endTime: '23:59' },
    });

    expect((await dayOf(leader.token, yesterday)).venueEvents).toEqual([]);
    const refused = await add(leader.token, gone.id);
    expect(refused.status).toBe(409);
    expect(refused.body.errors).toContain(ERROR.venueEventPast);
    expect(await prisma.calendarEvent.count({ where: { venueEventId: gone.id } })).toBe(0);
  });

  it('takes a withdrawn event out of the calendars it was added to, and tells those teams only', async () => {
    const nimes = await venue();
    const token = await managerOf(nimes.id);
    const adding = await teamOf(nimes.id);
    const mate = await createTeamMember(adding.token, adding.team.id);
    const other = await teamOf(nimes.id);
    const published = await publish(token, nimes.id, NIGHT);
    const added = await add(adding.token, published.body.id);

    await request(app).delete(`/api/manager/venues/${nimes.id}/events/${published.body.id}`).set(authHeader(token)).expect(204);

    expect(await prisma.calendarEvent.findUnique({ where: { id: added.body.eventId } })).toBeNull();
    const told = async (reader: { token: string }) => (await request(app).get('/api/notifications').set(authHeader(reader.token))).body.notifications
      .map((notification: { kind: string }) => notification.kind);
    expect(await told(adding)).toEqual(['VENUE_EVENT_WITHDRAWN']);
    expect(await told(mate)).toEqual(['VENUE_EVENT_WITHDRAWN']);
    expect(await told(other)).toEqual([]);
    expect((await request(app).delete(`/api/manager/venues/${nimes.id}/events/${published.body.id}`).set(authHeader(token))).status).toBe(404);
  });
});
