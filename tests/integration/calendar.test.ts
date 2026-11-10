// Integration tests - Calendar routes

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam, authHeader } from './helpers/auth';
import { prisma, expectNoRecordCreated } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';

// Helper to get current month in YYYY-MM format
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// Helper to get a valid future date
const getFutureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
};

// Venues made here each need a public board name of their own
let venuesMade = 0;

// Create a venue, and optionally affiliate a team with it
async function createVenue(
  overrides: { name?: string; city?: string; teamId?: string; arenaCount?: number } = {},
) {
  venuesMade += 1;
  const venue = await prisma.venue.create({
    data: {
      slug: `venue-${venuesMade}`,
      name: overrides.name ?? `Venue ${Date.now()}`,
      city: overrides.city ?? 'Lyon',
      address: '12 rue des Lasers',
      ...(overrides.arenaCount !== undefined && { arenaCount: overrides.arenaCount }),
    },
  });

  if (overrides.teamId) {
    await prisma.team.update({ where: { id: overrides.teamId }, data: { venueId: venue.id } });
  }

  return venue;
}

describe('Calendar API', () => {
  // ============================================
  // GET /api/calendar/availability
  // ============================================
  describe('GET /api/calendar/availability', () => {
    it('should return availability for authenticated user with team', async () => {
      const { token } = await createUserWithTeam();
      const month = getCurrentMonth();

      const res = await request(app)
        .get(`/api/calendar/availability?month=${month}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('month');
      expect(res.body).toHaveProperty('days');
      expect(res.body.month).toBe(month);
      expect(typeof res.body.days).toBe('object');
    });

    it('should mark the days a team player renews their subscription', async () => {
      const { token, user } = await createUserWithTeam();

      await request(app)
        .put('/api/players/me/subscription')
        .set(authHeader(token))
        .send({ tier: 'GOLD', renewalDate: '2026-10-05' })
        .expect(200);

      const res = await request(app)
        .get('/api/calendar/availability?month=2026-11')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      const renewalDays = Object.values(res.body.days as Record<string, { date: string; renewals: unknown[] }>)
        .filter(day => day.renewals.length)
        .map(day => day.date);
      // 2026-10-05 + 30 days = 2026-11-04; the next one (2026-12-04) is outside November
      expect(renewalDays).toEqual(['2026-11-04']);
      expect(res.body.days['2026-11-04'].renewals).toEqual([
        { playerId: user.playerId, playerName: user.name, tier: 'GOLD' },
      ]);
    });

    it('should not mark renewals before the entered date', async () => {
      const { token } = await createUserWithTeam();

      await request(app)
        .put('/api/players/me/subscription')
        .set(authHeader(token))
        .send({ tier: null, renewalDate: '2026-12-10' })
        .expect(200);

      const res = await request(app)
        .get('/api/calendar/availability?month=2026-11')
        .set(authHeader(token));

      const days = Object.values(res.body.days as Record<string, { renewals: unknown[] }>);
      expect(days.every(day => day.renewals.length === 0)).toBe(true);
    });

    it('should reject without authentication', async () => {
      const month = getCurrentMonth();

      const res = await request(app)
        .get(`/api/calendar/availability?month=${month}`);

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.unauthorized);
    });

    it('should reject with invalid month parameter', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/calendar/availability?month=invalid')
        .set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.monthParamRequired);
    });

    it('should reject user without team', async () => {
      const { token } = await createAuthenticatedUser();
      const month = getCurrentMonth();

      const res = await request(app)
        .get(`/api/calendar/availability?month=${month}`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.teamRequiredForCalendar);
    });
  });

  // ============================================
  // POST /api/calendar/availability
  // ============================================
  describe('POST /api/calendar/availability', () => {
    it('should set availability successfully', async () => {
      const { token, user } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/availability')
        .set(authHeader(token))
        .send({ date, status: 'AVAILABLE' });

      expect(res.status).toBe(200);

      // Verify in DB
      const availability = await prisma.availability.findFirst({
        where: { playerId: user.playerId!, date: new Date(date) },
      });
      expect(availability).not.toBeNull();
      expect(availability!.status).toBe('AVAILABLE');
    });

    it('should accept voice-only availability and return it with the month', async () => {
      const { token, user } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/availability')
        .set(authHeader(token))
        .send({ date, status: 'VOICE_ONLY' });

      expect(res.status).toBe(200);

      const month = await request(app)
        .get(`/api/calendar/availability?month=${date.substring(0, 7)}`)
        .set(authHeader(token));
      expect(month.body.days[date].currentPlayerStatus).toBe('VOICE_ONLY');
      expect(month.body.days[date].playerAvailabilities).toContainEqual({
        playerId: user.playerId,
        playerName: user.name,
        status: 'VOICE_ONLY',
        hours: null,
      });
    });

    it('should keep the hours of a partial availability, and give them with the month', async () => {
      const { token, user } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/availability')
        .set(authHeader(token))
        .send({ date, status: 'PARTIAL', hours: { startTime: '21:00', endTime: null } });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'PARTIAL', hours: { startTime: '21:00', endTime: null } });
      const month = await request(app)
        .get(`/api/calendar/availability?month=${date.substring(0, 7)}`)
        .set(authHeader(token));
      expect(month.body.days[date].currentPlayerHours).toEqual({ startTime: '21:00', endTime: null });
      expect(month.body.days[date].playerAvailabilities).toContainEqual({
        playerId: user.playerId,
        playerName: user.name,
        status: 'PARTIAL',
        hours: { startTime: '21:00', endTime: null },
      });
    });

    it('should drop the hours once the answer is no longer partial', async () => {
      const { token, user } = await createUserWithTeam();
      const date = getFutureDate();
      const auth = authHeader(token);
      await request(app).post('/api/calendar/availability').set(auth).send({ date, status: 'PARTIAL', hours: { startTime: '20:00', endTime: '23:00' } }).expect(200);

      await request(app).post('/api/calendar/availability').set(auth).send({ date, status: 'AVAILABLE' }).expect(200);

      const stored = await prisma.availability.findFirstOrThrow({ where: { playerId: user.playerId!, date: new Date(date) } });
      expect(stored).toMatchObject({ status: 'AVAILABLE', startTime: null, endTime: null });
    });

    it('should refuse a partial availability without valid hours, and hours on any other answer', async () => {
      const { token, user } = await createUserWithTeam();
      const date = getFutureDate();
      const send = (body: Record<string, unknown>) => request(app)
        .post('/api/calendar/availability')
        .set(authHeader(token))
        .send({ date, ...body });

      for (const body of [
        { status: 'PARTIAL' },
        { status: 'PARTIAL', hours: { startTime: null, endTime: null } },
        { status: 'PARTIAL', hours: { startTime: '23:00', endTime: '20:00' } },
        { status: 'PARTIAL', hours: { startTime: '24:30', endTime: null } },
        { status: 'AVAILABLE', hours: { startTime: '20:00', endTime: null } },
      ]) {
        const res = await send(body);
        expect(res.status).toBe(400);
        expect(res.body.errors).toContain(ERROR.availabilityHoursInvalid);
      }
      expect(await prisma.availability.count({ where: { playerId: user.playerId! } })).toBe(0);
    });

    it('should reject without authentication', async () => {
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/availability')
        .send({ date, status: 'AVAILABLE' });

      expect(res.status).toBe(401);
    });

    it('should reject with invalid date', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .post('/api/calendar/availability')
        .set(authHeader(token))
        .send({ date: 'invalid-date', status: 'AVAILABLE' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.dateInvalid);
    });

    it('should reject with invalid status', async () => {
      const { token } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/availability')
        .set(authHeader(token))
        .send({ date, status: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.statusInvalid);
    });
  });

  // ============================================
  // GET /api/calendar/events
  // ============================================
  describe('GET /api/calendar/events', () => {
    it('should return events for authenticated user with team', async () => {
      const { token, team } = await createUserWithTeam();
      const date = getFutureDate();
      const month = date.substring(0, 7);

      // Create an event first
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date,
          startTime: '19:00',
          endTime: '21:00',
          type: 'EVENT',
          title: 'Test Event for GET',
        });

      expect(createRes.status).toBe(201);

      // Fetch events
      const res = await request(app)
        .get(`/api/calendar/events?month=${month}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Verify event structure and content
      const event = res.body.find((e: any) => e.title === 'Test Event for GET');
      expect(event).toBeDefined();
      expect(event.type).toBe('EVENT');
      expect(event.startTime).toBe('19:00');
      expect(event.endTime).toBe('21:00');
    });

    it('should reject without authentication', async () => {
      const month = getCurrentMonth();

      const res = await request(app)
        .get(`/api/calendar/events?month=${month}`);

      expect(res.status).toBe(401);
    });

    it('should reject with invalid month parameter', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/calendar/events?month=invalid')
        .set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.monthParamRequired);
    });

    it('should reject user without team', async () => {
      const { token } = await createAuthenticatedUser();
      const month = getCurrentMonth();

      const res = await request(app)
        .get(`/api/calendar/events?month=${month}`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.teamRequiredForCalendar);
    });

    it('should isolate events by team', async () => {
      const { token: token1, team: team1, user: user1 } = await createUserWithTeam();
      const { token: token2, team: team2 } = await createUserWithTeam();

      const date = getFutureDate();
      const month = date.substring(0, 7);

      // Create event for team1 via API
      await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token1))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
          title: 'Team1 Event',
        });

      // Create event for team2 via API
      await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token2))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
          title: 'Team2 Event',
        });

      // Team1 should only see their event
      const res1 = await request(app)
        .get(`/api/calendar/events?month=${month}`)
        .set(authHeader(token1));

      expect(res1.status).toBe(200);
      expect(res1.body.some((e: any) => e.title === 'Team1 Event')).toBe(true);
      expect(res1.body.some((e: any) => e.title === 'Team2 Event')).toBe(false);

      // Team2 should only see their event
      const res2 = await request(app)
        .get(`/api/calendar/events?month=${month}`)
        .set(authHeader(token2));

      expect(res2.status).toBe(200);
      expect(res2.body.some((e: any) => e.title === 'Team2 Event')).toBe(true);
      expect(res2.body.some((e: any) => e.title === 'Team1 Event')).toBe(false);
    });
  });

  // ============================================
  // POST /api/calendar/events
  // ============================================
  describe('POST /api/calendar/events', () => {
    it('should create event successfully', async () => {
      const { token, team } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Test Match',
          description: 'Test description',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('Test Match');

      // Verify in DB
      const event = await prisma.calendarEvent.findUnique({ where: { id: res.body.id } });
      expect(event).not.toBeNull();
      expect(event!.teamId).toBe(team.id);
    });

    it('should create a competition the team plays, with no venue of its own', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '14:00',
          endTime: '19:00',
          type: 'COMPETITION',
          title: 'NEMAUSUS LEAGUE - DÉCEMBRE',
          description: 'Rendez-vous 13:30 à la salle',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ type: 'COMPETITION', title: 'NEMAUSUS LEAGUE - DÉCEMBRE' });
      expect(res.body.venue).toBeUndefined();
      const event = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(event).toMatchObject({ type: 'COMPETITION', teamId: team.id, venueId: null, evaSlotIds: [] });
    });

    it('should create a voice meeting on the platform it is held on', async () => {
      const { token, team } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date,
          startTime: '21:00',
          endTime: '22:30',
          type: 'VOICE_MEETING',
          title: 'Strat Polaris',
          voiceMedium: 'TEAMSPEAK',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('VOICE_MEETING');
      expect(res.body.voiceMedium).toBe('TEAMSPEAK');

      const event = await prisma.calendarEvent.findUnique({ where: { id: res.body.id } });
      expect(event!.type).toBe('VOICE_MEETING');
      expect(event!.voiceMedium).toBe('TEAMSPEAK');
      expect(event!.teamId).toBe(team.id);
    });

    it('should reject a voice meeting with no platform', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '21:00',
          endTime: '22:30',
          type: 'VOICE_MEETING',
          title: 'Strat Polaris',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.voiceMediumRequired);
    });

    it('should reject a platform it does not know', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '21:00',
          endTime: '22:30',
          type: 'VOICE_MEETING',
          title: 'Strat Polaris',
          voiceMedium: 'SKYPE',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.voiceMediumInvalid);
    });

    it('should reject a platform on an event that is not held on one', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '21:00',
          endTime: '22:30',
          type: 'EVENT',
          title: 'Tournoi',
          voiceMedium: 'DISCORD',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.voiceMeetingOnlyMedium);
    });

    it('should reject the event type a voice meeting used to have', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '21:00',
          endTime: '22:30',
          type: 'DISCORD',
          title: 'Strat Polaris',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.eventTypeInvalid);
    });

    it('should reject without authentication', async () => {
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/events')
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
          title: 'Test Event',
        });

      expect(res.status).toBe(401);
    });

    it('should reject user without team', async () => {
      const { token } = await createAuthenticatedUser();
      const date = getFutureDate();

      const res = await expectNoRecordCreated(
        () => prisma.calendarEvent.count(),
        () => request(app)
          .post('/api/calendar/events')
          .set(authHeader(token))
          .send({
            date,
            startTime: '20:00',
            endTime: '22:00',
            type: 'EVENT',
            title: 'Test Event',
          })
      );

      expect(res.status).toBe(403);
    });

    it('should reject with invalid date', async () => {
      const { token, team } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.calendarEvent.count({ where: { teamId: team.id } }),
        () => request(app)
          .post('/api/calendar/events')
          .set(authHeader(token))
          .send({
            date: 'invalid',
            startTime: '20:00',
            endTime: '22:00',
            type: 'EVENT',
            title: 'Test Event',
          })
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.dateInvalid);
    });

    it('should reject with invalid event type', async () => {
      const { token, team } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await expectNoRecordCreated(
        () => prisma.calendarEvent.count({ where: { teamId: team.id } }),
        () => request(app)
          .post('/api/calendar/events')
          .set(authHeader(token))
          .send({
            date,
            startTime: '20:00',
            endTime: '22:00',
            type: 'INVALID_TYPE',
            title: 'Test Event',
          })
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.eventTypeInvalid);
    });

    it('should reject without title', async () => {
      const { token, team } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await expectNoRecordCreated(
        () => prisma.calendarEvent.count({ where: { teamId: team.id } }),
        () => request(app)
          .post('/api/calendar/events')
          .set(authHeader(token))
          .send({
            date,
            startTime: '20:00',
            endTime: '22:00',
            type: 'EVENT',
            title: '',
          })
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.titleRequired);
    });
  });

  // ============================================
  // DELETE /api/calendar/events/:id
  // ============================================
  describe('DELETE /api/calendar/events/:id', () => {
    it('should delete event successfully', async () => {
      const { token, team } = await createUserWithTeam();
      const date = getFutureDate();

      // Create event first
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
          title: 'To Delete',
        });

      const eventId = createRes.body.id;

      // Delete it
      const res = await request(app)
        .delete(`/api/calendar/events/${eventId}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deleted in DB
      const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
      expect(event).toBeNull();
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .delete('/api/calendar/events/some-id');

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent event', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .delete('/api/calendar/events/non-existent-id')
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.eventNotFound);
    });

    it('should reject deleting event from another team', async () => {
      const { token: token1 } = await createUserWithTeam();
      const { token: token2 } = await createUserWithTeam();
      const date = getFutureDate();

      // Create event with team1
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token1))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
          title: 'Team1 Only',
        });

      const eventId = createRes.body.id;

      // Try to delete with team2
      const res = await request(app)
        .delete(`/api/calendar/events/${eventId}`)
        .set(authHeader(token2));

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.accessDenied);

      // Verify NOT deleted
      const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
      expect(event).not.toBeNull();
    });
  });

  // ============================================
  // PUT /api/calendar/events/:id
  // ============================================
  describe('PUT /api/calendar/events/:id', () => {
    it('should update event successfully', async () => {
      const { token } = await createUserWithTeam();
      const date = getFutureDate();

      // Create event first
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
          title: 'Original Title',
        });

      const eventId = createRes.body.id;

      // Update it
      const res = await request(app)
        .put(`/api/calendar/events/${eventId}`)
        .set(authHeader(token))
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');

      // Verify in DB
      const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
      expect(event!.title).toBe('Updated Title');
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .put('/api/calendar/events/some-id')
        .send({ title: 'New Title' });

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent event', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .put('/api/calendar/events/non-existent-id')
        .set(authHeader(token))
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
    });

    it('should reject updating event from another team', async () => {
      const { token: token1 } = await createUserWithTeam();
      const { token: token2 } = await createUserWithTeam();
      const date = getFutureDate();

      // Create event with team1
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token1))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
          title: 'Team1 Event',
        });

      const eventId = createRes.body.id;

      // Try to update with team2
      const res = await request(app)
        .put(`/api/calendar/events/${eventId}`)
        .set(authHeader(token2))
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);

      // Verify NOT updated
      const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
      expect(event!.title).toBe('Team1 Event');
    });
  });

  // ============================================
  // Event edit
  // ============================================
  describe('Event edit', () => {
    async function createEvent(token: string, body: Record<string, unknown> = {}) {
      return request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
          title: 'Soirée LAN',
          description: 'On se retrouve 30 min avant',
          ...body,
        });
    }

    it('should clear the description when it is emptied', async () => {
      const { token } = await createUserWithTeam();
      const created = await createEvent(token);

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ description: '' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBeUndefined();

      const event = await prisma.calendarEvent.findUnique({ where: { id: created.body.id } });
      expect(event!.description).toBeNull();
    });

    it.each(['', '   '])('should refuse %p as a new title instead of ignoring it', async (title) => {
      const { token } = await createUserWithTeam();
      const created = await createEvent(token);

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ title });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.titleRequired);

      const event = await prisma.calendarEvent.findUnique({ where: { id: created.body.id } });
      expect(event!.title).toBe('Soirée LAN');
    });

    it('should refuse an empty date instead of ignoring it', async () => {
      const { token } = await createUserWithTeam();
      const created = await createEvent(token);

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ date: '' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.dateInvalid);
    });

    it('should refuse an end time that is not after the start time', async () => {
      const { token } = await createUserWithTeam();
      const created = await createEvent(token);

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ startTime: '22:00', endTime: '20:00' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.eventTimeInvalid);
    });

    it('should refuse an end time before the start time on creation too', async () => {
      const { token } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.calendarEvent.count(),
        () => createEvent(token, { startTime: '22:00', endTime: '22:00' }),
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.eventTimeInvalid);
    });

    it('should refuse an end time moved before the start time already stored', async () => {
      const { token } = await createUserWithTeam();
      const created = await createEvent(token);

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ endTime: '19:00' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.eventTimeInvalid);
    });

    it('should still move the end time on its own when it stays valid', async () => {
      const { token } = await createUserWithTeam();
      const created = await createEvent(token);

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ endTime: '23:30' });

      expect(res.status).toBe(200);
      expect(res.body.endTime).toBe('23:30');
      expect(res.body.startTime).toBe('20:00');
    });
  });

  // ============================================
  // Match venue
  // ============================================
  describe('Match venue', () => {
    it('should play a new match in the team venue by default', async () => {
      const { token, team } = await createUserWithTeam();
      const venue = await createVenue({ name: 'VR Arena', city: 'Lyon', teamId: team.id });

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs TeamX',
        });

      expect(res.status).toBe(201);
      expect(res.body.venue).toEqual({ id: venue.id, name: 'VR Arena', evaLocationId: null, discord: null });
    });

    it('should play the match in the chosen venue, team venue or not', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ name: 'Home', teamId: team.id });
      const away = await createVenue({ name: 'Away', city: 'Paris' });

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Away game',
          venueId: away.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.venue).toEqual({ id: away.id, name: 'Away', evaLocationId: null, discord: null });
    });

    it('should accept a match with no venue even when the team has one', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Venue to be decided',
          venueId: null,
        });

      expect(res.status).toBe(201);
      expect(res.body.venue).toBeUndefined();
    });

    it('should leave a match without venue when the team has none', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'No affiliation',
        });

      expect(res.status).toBe(201);
      expect(res.body.venue).toBeUndefined();
    });

    it('should reject an unknown venue without creating the event', async () => {
      const { token } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.calendarEvent.count(),
        () => request(app)
          .post('/api/calendar/events')
          .set(authHeader(token))
          .send({
            date: getFutureDate(),
            startTime: '20:00',
            endTime: '22:00',
            type: 'MATCH',
            title: 'Nowhere',
            venueId: 'non-existent',
          }),
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.venueNotFound);
    });

    it.each(['COMPETITION', 'EVENT', 'VOICE_MEETING'])('should reject a venue on a %s', async (type) => {
      const { token, team } = await createUserWithTeam();
      const venue = await createVenue({ teamId: team.id });

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type,
          title: 'Not a match',
          venueId: venue.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.matchOnlyVenue);
    });

    it('should not give the team venue to a non-match', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const res = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '21:00',
          endTime: '22:00',
          type: 'VOICE_MEETING',
          title: 'Strat session',
          voiceMedium: 'DISCORD',
        });

      expect(res.status).toBe(201);
      expect(res.body.venue).toBeUndefined();
    });

    it('should move a match to another venue and keep it when left out', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ name: 'Home', teamId: team.id });
      const away = await createVenue({ name: 'Away', city: 'Paris' });

      const created = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs TeamX',
        });

      const moved = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ venueId: away.id });

      expect(moved.status).toBe(200);
      expect(moved.body.venue.id).toBe(away.id);

      // Updating something else leaves the venue alone
      const renamed = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ title: 'Match vs TeamY' });

      expect(renamed.body.venue.id).toBe(away.id);
    });

    it('should drop the venue when a match stops being a match', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const created = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs TeamX',
        });
      expect(created.body.venue).toBeDefined();

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ type: 'VOICE_MEETING', voiceMedium: 'DISCORD' });

      expect(res.status).toBe(200);
      expect(res.body.venue).toBeUndefined();

      const event = await prisma.calendarEvent.findUnique({ where: { id: created.body.id } });
      expect(event!.venueId).toBeNull();
    });

    it('should return the venue with the month data', async () => {
      const { token, team } = await createUserWithTeam();
      const venue = await createVenue({ name: 'VR Arena', city: 'Lyon', teamId: team.id });
      const date = getFutureDate();

      await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({ date, startTime: '20:00', endTime: '22:00', type: 'MATCH', title: 'Match vs TeamX' })
        .expect(201);

      const month = await request(app)
        .get(`/api/calendar/availability?month=${date.substring(0, 7)}`)
        .set(authHeader(token));

      expect(month.body.days[date].events[0].venue)
        .toEqual({ id: venue.id, name: 'VR Arena', evaLocationId: null, discord: null });
    });
  });

  // ============================================
  // Match arena
  // ============================================
  describe('Match arena', () => {
    async function createMatch(token: string, body: Record<string, unknown> = {}) {
      return request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs TeamX',
          ...body,
        });
    }

    it('should play the match on the chosen arena of the venue', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });

      const res = await createMatch(token, { arenaNumber: 2 });

      expect(res.status).toBe(201);
      expect(res.body.arenaNumber).toBe(2);
    });

    it('should leave the arena undecided when none is given', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });

      const res = await createMatch(token);

      expect(res.status).toBe(201);
      expect(res.body.arenaNumber).toBeUndefined();
    });

    it('should refuse an arena the venue does not have', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });

      const res = await expectNoRecordCreated(
        () => prisma.calendarEvent.count(),
        () => createMatch(token, { arenaNumber: 3 }),
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.arenaNumberInvalid);
    });

    it.each([0, -1, 1.5])('should refuse %s as an arena number', async (arenaNumber) => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });

      const res = await createMatch(token, { arenaNumber });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.arenaNumberInvalid);
    });

    it('should refuse an arena on a match played nowhere', async () => {
      const { token } = await createUserWithTeam();

      const res = await createMatch(token, { venueId: null, arenaNumber: 1 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.arenaRequiresVenue);
    });

    it('should refuse an arena on an event that is not a match', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });

      const res = await createMatch(token, { type: 'VOICE_MEETING', arenaNumber: 1 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.arenaRequiresVenue);
    });

    it('should move the match to another arena of the same venue', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 3 });
      const created = await createMatch(token, { arenaNumber: 1 });

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ arenaNumber: 3 });

      expect(res.status).toBe(200);
      expect(res.body.arenaNumber).toBe(3);
    });

    it('should keep the arena when the update is about something else', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });
      const created = await createMatch(token, { arenaNumber: 2 });

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ title: 'Match vs TeamY' });

      expect(res.status).toBe(200);
      expect(res.body.arenaNumber).toBe(2);
    });

    it('should drop the arena when the match moves to another venue', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });
      const away = await createVenue({ name: 'Away', arenaCount: 2 });
      const created = await createMatch(token, { arenaNumber: 2 });

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ venueId: away.id });

      expect(res.status).toBe(200);
      expect(res.body.venue.id).toBe(away.id);
      expect(res.body.arenaNumber).toBeUndefined();
    });

    it('should drop the arena when the match stops being a match', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });
      const created = await createMatch(token, { arenaNumber: 2 });

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set(authHeader(token))
        .send({ type: 'EVENT' });

      expect(res.status).toBe(200);
      expect(res.body.arenaNumber).toBeUndefined();

      const event = await prisma.calendarEvent.findUnique({ where: { id: created.body.id } });
      expect(event!.arenaNumber).toBeNull();
    });

    it('should return the arena with the month data', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 2 });
      const date = getFutureDate();

      const created = await createMatch(token, { date, arenaNumber: 2 });
      expect(created.status).toBe(201);

      const month = await request(app)
        .get(`/api/calendar/availability?month=${date.substring(0, 7)}`)
        .set(authHeader(token));

      expect(month.body.days[date].events[0].arenaNumber).toBe(2);
    });
  });

  // ============================================
  // PUT /api/calendar/events/:id/gameplan
  // ============================================
  describe('PUT /api/calendar/events/:id/gameplan', () => {
    it('should attach gameplan to MATCH event', async () => {
      const { token } = await createUserWithTeam();
      const date = getFutureDate();

      // Create MATCH event
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Test Match',
        });

      const eventId = createRes.body.id;
      const gamePlan = { strategy: 'test', positions: [] };

      // Attach gameplan
      const res = await request(app)
        .put(`/api/calendar/events/${eventId}/gameplan`)
        .set(authHeader(token))
        .send({ gamePlan });

      expect(res.status).toBe(200);

      // Verify in DB
      const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
      expect(event!.gamePlan).not.toBeNull();
    });

    it.each([
      { type: 'EVENT' },
      { type: 'VOICE_MEETING', voiceMedium: 'DISCORD' },
    ])('should reject attaching gameplan to $type type', async (eventBody) => {
      const { token } = await createUserWithTeam();
      const date = getFutureDate();

      // Create a non-MATCH event
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          title: 'Not a Match',
          ...eventBody,
        });

      const eventId = createRes.body.id;

      const res = await request(app)
        .put(`/api/calendar/events/${eventId}/gameplan`)
        .set(authHeader(token))
        .send({ gamePlan: { strategy: 'test' } });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.matchOnlyGamePlan);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .put('/api/calendar/events/some-id/gameplan')
        .send({ gamePlan: {} });

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent event', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .put('/api/calendar/events/non-existent-id/gameplan')
        .set(authHeader(token))
        .send({ gamePlan: {} });

      expect(res.status).toBe(404);
    });
  });
  // ============================================
  // Match slot (eva.gg)
  // ============================================
  describe('Match slots', () => {
    const SLOT_20H = '35313a36303a323032362d31312d30333a323032362d31312d30335431393a30303a30305a3a3430';
    const SLOT_20H40 = '35313a36303a323032362d31312d30333a323032362d31312d30335431393a34303a30305a3a3430';

    async function createMatch(token: string, body: Record<string, unknown> = {}) {
      return request(app)
        .post('/api/calendar/events')
        .set(authHeader(token))
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '21:20',
          type: 'MATCH',
          title: 'Match vs TeamX',
          ...body,
        });
    }

    async function update(token: string, id: string, body: Record<string, unknown>) {
      return request(app)
        .put(`/api/calendar/events/${id}`)
        .set(authHeader(token))
        .send(body);
    }

    it('should play the match on the chosen slots of the venue, in order', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const res = await createMatch(token, { evaSlotIds: [` ${SLOT_20H} `, SLOT_20H40] });

      expect(res.status).toBe(201);
      expect(res.body.evaSlotIds).toEqual([SLOT_20H, SLOT_20H40]);

      const event = await prisma.calendarEvent.findUnique({ where: { id: res.body.id } });
      expect(event!.evaSlotIds).toEqual([SLOT_20H, SLOT_20H40]);
    });

    it('should leave the slots empty when none was picked', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      for (const body of [{}, { evaSlotIds: null }, { evaSlotIds: [] }]) {
        const res = await createMatch(token, body);
        expect(res.status).toBe(201);
        expect(res.body.evaSlotIds).toEqual([]);
      }
    });

    it('should refuse slots without a venue', async () => {
      const { token } = await createUserWithTeam();

      const res = await createMatch(token, { venueId: null, evaSlotIds: [SLOT_20H] });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.slotRequiresVenue);
    });

    it('should refuse slots on anything but a match', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const res = await createMatch(token, { type: 'EVENT', evaSlotIds: [SLOT_20H] });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.matchOnlySlot);
    });

    it.each([
      ['a bare string', SLOT_20H],
      ['an empty id', ['']],
      ['a number', [42]],
      ['an oversized id', ['x'.repeat(201)]],
      ['the same slot twice', [SLOT_20H, SLOT_20H]],
      ['too many slots', Array.from({ length: 7 }, (_, i) => `slot-${i}`)],
    ])('should refuse %s as a slot list', async (_label, evaSlotIds) => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const res = await createMatch(token, { evaSlotIds });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.evaSlotsInvalid);
    });

    it('should keep the slots when the update does not touch where or when the match is played', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });
      const created = await createMatch(token, { evaSlotIds: [SLOT_20H, SLOT_20H40] });

      const res = await update(token, created.body.id, { title: 'Match vs TeamY', endTime: '21:30' });

      expect(res.status).toBe(200);
      expect(res.body.evaSlotIds).toEqual([SLOT_20H, SLOT_20H40]);
    });

    it('should replace the slots when others are stated', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });
      const created = await createMatch(token, { evaSlotIds: [SLOT_20H] });

      const res = await update(token, created.body.id, { startTime: '20:40', endTime: '21:20', evaSlotIds: [SLOT_20H40] });

      expect(res.status).toBe(200);
      expect(res.body.evaSlotIds).toEqual([SLOT_20H40]);
    });

    it('should clear the slots on an explicit null or empty list', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });
      const created = await createMatch(token, { evaSlotIds: [SLOT_20H] });

      const res = await update(token, created.body.id, { evaSlotIds: null });

      expect(res.status).toBe(200);
      expect(res.body.evaSlotIds).toEqual([]);
      const event = await prisma.calendarEvent.findUnique({ where: { id: created.body.id } });
      expect(event!.evaSlotIds).toEqual([]);
    });

    it.each([
      ['the day moves', () => ({ date: '2030-01-15' })],
      ['the start time moves', () => ({ startTime: '20:40', endTime: '21:20' })],
    ])('should drop slots that were not re-stated when %s', async (_label, body) => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });
      const created = await createMatch(token, { evaSlotIds: [SLOT_20H, SLOT_20H40] });

      const res = await update(token, created.body.id, body());

      expect(res.status).toBe(200);
      expect(res.body.evaSlotIds).toEqual([]);
    });

    it('should drop the slots when the match moves to another venue', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });
      const away = await createVenue({ name: 'Away' });
      const created = await createMatch(token, { evaSlotIds: [SLOT_20H] });

      const res = await update(token, created.body.id, { venueId: away.id });

      expect(res.status).toBe(200);
      expect(res.body.venue.id).toBe(away.id);
      expect(res.body.evaSlotIds).toEqual([]);
    });

    it('should keep the slots when the same day and start time are sent again', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });
      const created = await createMatch(token, { evaSlotIds: [SLOT_20H] });

      const res = await update(token, created.body.id, { date: created.body.date, startTime: '20:00' });

      expect(res.status).toBe(200);
      expect(res.body.evaSlotIds).toEqual([SLOT_20H]);
    });

    it('should drop the slots when the match stops being a match', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });
      const created = await createMatch(token, { evaSlotIds: [SLOT_20H] });

      const res = await update(token, created.body.id, { type: 'EVENT' });

      expect(res.status).toBe(200);
      expect(res.body.evaSlotIds).toEqual([]);
    });

    it('should return the slots with the month data', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });
      const date = getFutureDate();
      await createMatch(token, { date, evaSlotIds: [SLOT_20H, SLOT_20H40] });

      const month = await request(app)
        .get(`/api/calendar/availability?month=${date!.substring(0, 7)}`)
        .set(authHeader(token));

      expect(month.body.days[date!].events[0].evaSlotIds).toEqual([SLOT_20H, SLOT_20H40]);
    });
  });
});
