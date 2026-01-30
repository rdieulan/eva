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
        where: { userId: user.id, date: new Date(date) },
      });
      expect(availability).not.toBeNull();
      expect(availability!.status).toBe('AVAILABLE');
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

    it('should reject attaching gameplan to EVENT type', async () => {
      const { token } = await createUserWithTeam();
      const date = getFutureDate();

      // Create EVENT (not MATCH)
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date,
          startTime: '20:00',
          endTime: '22:00',
          type: 'EVENT',
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
