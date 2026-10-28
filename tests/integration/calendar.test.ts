// Integration tests - Calendar routes

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam } from './helpers/auth';
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

// Create a venue, and optionally affiliate a team with it
async function createVenue(
  overrides: { name?: string; city?: string; teamId?: string; arenaCount?: number } = {},
) {
  const venue = await prisma.venue.create({
    data: {
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
        .set('Authorization', `Bearer ${token}`);

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
        .set('Authorization', `Bearer ${token}`)
        .send({ tier: 'GOLD', renewalDate: '2026-10-05' })
        .expect(200);

      const res = await request(app)
        .get('/api/calendar/availability?month=2026-11')
        .set('Authorization', `Bearer ${token}`);

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
        .set('Authorization', `Bearer ${token}`)
        .send({ tier: null, renewalDate: '2026-12-10' })
        .expect(200);

      const res = await request(app)
        .get('/api/calendar/availability?month=2026-11')
        .set('Authorization', `Bearer ${token}`);

      const days = Object.values(res.body.days as Record<string, { renewals: unknown[] }>);
      expect(days.every(day => day.renewals.length === 0)).toBe(true);
    });

    it('should reject without authentication', async () => {
      const month = getCurrentMonth();

      const res = await request(app)
        .get(`/api/calendar/availability?month=${month}`);

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.tokenMissing);
    });

    it('should reject with invalid month parameter', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/calendar/availability?month=invalid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.monthParamRequired);
    });

    it('should reject user without team', async () => {
      const { token } = await createAuthenticatedUser();
      const month = getCurrentMonth();

      const res = await request(app)
        .get(`/api/calendar/availability?month=${month}`)
        .set('Authorization', `Bearer ${token}`);

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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
        .send({ date, status: 'VOICE_ONLY' });

      expect(res.status).toBe(200);

      const month = await request(app)
        .get(`/api/calendar/availability?month=${date.substring(0, 7)}`)
        .set('Authorization', `Bearer ${token}`);
      expect(month.body.days[date].currentPlayerStatus).toBe('VOICE_ONLY');
      expect(month.body.days[date].playerAvailabilities).toContainEqual({
        playerId: user.playerId,
        playerName: user.name,
        status: 'VOICE_ONLY',
      });
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
        .set('Authorization', `Bearer ${token}`)
        .send({ date: 'invalid-date', status: 'AVAILABLE' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.dateInvalid);
    });

    it('should reject with invalid status', async () => {
      const { token } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/availability')
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`);

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
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.monthParamRequired);
    });

    it('should reject user without team', async () => {
      const { token } = await createAuthenticatedUser();
      const month = getCurrentMonth();

      const res = await request(app)
        .get(`/api/calendar/events?month=${month}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.teamRequiredForCalendar);
    });

    it('should isolate events by team', async () => {
      const { token: token1, team: team1, user: user1 } = await createUserWithTeam({
        email: 'team1-cal@example.com',
      });
      const { token: token2, team: team2 } = await createUserWithTeam({
        email: 'team2-cal@example.com',
      });

      const date = getFutureDate();
      const month = date.substring(0, 7);

      // Create event for team1 via API
      await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token1}`)
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
        .set('Authorization', `Bearer ${token2}`)
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
        .set('Authorization', `Bearer ${token1}`);

      expect(res1.status).toBe(200);
      expect(res1.body.some((e: any) => e.title === 'Team1 Event')).toBe(true);
      expect(res1.body.some((e: any) => e.title === 'Team2 Event')).toBe(false);

      // Team2 should only see their event
      const res2 = await request(app)
        .get(`/api/calendar/events?month=${month}`)
        .set('Authorization', `Bearer ${token2}`);

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
        .set('Authorization', `Bearer ${token}`)
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

    it('should create a Discord strategy session', async () => {
      const { token, team } = await createUserWithTeam();
      const date = getFutureDate();

      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date,
          startTime: '21:00',
          endTime: '22:30',
          type: 'DISCORD',
          title: 'Strat Polaris',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('DISCORD');

      const event = await prisma.calendarEvent.findUnique({ where: { id: res.body.id } });
      expect(event!.type).toBe('DISCORD');
      expect(event!.teamId).toBe(team.id);
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
          .set('Authorization', `Bearer ${token}`)
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
          .set('Authorization', `Bearer ${token}`)
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
          .set('Authorization', `Bearer ${token}`)
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
          .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`);

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
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.eventNotFound);
    });

    it('should reject deleting event from another team', async () => {
      const { token: token1 } = await createUserWithTeam({ email: 'owner@example.com' });
      const { token: token2 } = await createUserWithTeam({ email: 'other@example.com' });
      const date = getFutureDate();

      // Create event with team1
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token1}`)
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
        .set('Authorization', `Bearer ${token2}`);

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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
    });

    it('should reject updating event from another team', async () => {
      const { token: token1 } = await createUserWithTeam({ email: 'owner2@example.com' });
      const { token: token2 } = await createUserWithTeam({ email: 'other2@example.com' });
      const date = getFutureDate();

      // Create event with team1
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token1}`)
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
        .set('Authorization', `Bearer ${token2}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);

      // Verify NOT updated
      const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
      expect(event!.title).toBe('Team1 Event');
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
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs TeamX',
        });

      expect(res.status).toBe(201);
      expect(res.body.venue).toEqual({ id: venue.id, name: 'VR Arena', city: 'Lyon' });
    });

    it('should play the match in the chosen venue, team venue or not', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ name: 'Home', teamId: team.id });
      const away = await createVenue({ name: 'Away', city: 'Paris' });

      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Away game',
          venueId: away.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.venue).toEqual({ id: away.id, name: 'Away', city: 'Paris' });
    });

    it('should accept a match with no venue even when the team has one', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
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
          .set('Authorization', `Bearer ${token}`)
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

    it.each(['EVENT', 'DISCORD'])('should reject a venue on a %s', async (type) => {
      const { token, team } = await createUserWithTeam();
      const venue = await createVenue({ teamId: team.id });

      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: getFutureDate(),
          startTime: '21:00',
          endTime: '22:00',
          type: 'DISCORD',
          title: 'Strat session',
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
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: getFutureDate(),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs TeamX',
        });

      const moved = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ venueId: away.id });

      expect(moved.status).toBe(200);
      expect(moved.body.venue.id).toBe(away.id);

      // Updating something else leaves the venue alone
      const renamed = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Match vs TeamY' });

      expect(renamed.body.venue.id).toBe(away.id);
    });

    it('should drop the venue when a match stops being a match', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id });

      const created = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'DISCORD' });

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
        .set('Authorization', `Bearer ${token}`)
        .send({ date, startTime: '20:00', endTime: '22:00', type: 'MATCH', title: 'Match vs TeamX' })
        .expect(201);

      const month = await request(app)
        .get(`/api/calendar/availability?month=${date.substring(0, 7)}`)
        .set('Authorization', `Bearer ${token}`);

      expect(month.body.days[date].events[0].venue)
        .toEqual({ id: venue.id, name: 'VR Arena', city: 'Lyon' });
    });
  });

  // ============================================
  // Match arena
  // ============================================
  describe('Match arena', () => {
    async function createMatch(token: string, body: Record<string, unknown> = {}) {
      return request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token}`)
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

      const res = await createMatch(token, { type: 'DISCORD', arenaNumber: 1 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.arenaRequiresVenue);
    });

    it('should move the match to another arena of the same venue', async () => {
      const { token, team } = await createUserWithTeam();
      await createVenue({ teamId: team.id, arenaCount: 3 });
      const created = await createMatch(token, { arenaNumber: 1 });

      const res = await request(app)
        .put(`/api/calendar/events/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`);

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
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
        .send({ gamePlan });

      expect(res.status).toBe(200);

      // Verify in DB
      const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
      expect(event!.gamePlan).not.toBeNull();
    });

    it.each(['EVENT', 'DISCORD'])('should reject attaching gameplan to %s type', async (type) => {
      const { token } = await createUserWithTeam();
      const date = getFutureDate();

      // Create a non-MATCH event
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type,
          title: 'Not a Match',
        });

      const eventId = createRes.body.id;

      const res = await request(app)
        .put(`/api/calendar/events/${eventId}/gameplan`)
        .set('Authorization', `Bearer ${token}`)
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
        .set('Authorization', `Bearer ${token}`)
        .send({ gamePlan: {} });

      expect(res.status).toBe(404);
    });
  });
});
