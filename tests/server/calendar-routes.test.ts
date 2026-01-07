// filepath: d:\PRO\PROJETS\eva\tests\server\calendar-routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CalendarEvent, DayData, AvailabilityStatus } from '@shared/types';

// Calendar Routes API Tests
describe('Calendar Routes API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================
  // Availability Routes Tests
  // ===========================================

  describe('GET /api/calendar/availability', () => {
    it('should fetch all availabilities for a month', async () => {
      const mockResponse = {
        month: '2026-01',
        days: {
          '2026-01-01': {
            date: '2026-01-01',
            currentUserStatus: 'AVAILABLE',
            playerAvailabilities: [
              { userId: 'user-1', userName: 'Player 1', status: 'AVAILABLE' },
              { userId: 'user-2', userName: 'Player 2', status: null },
            ],
            events: [],
          } as DayData,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await fetch('/api/calendar/availability?month=2026-01');
      const data = await response.json();

      expect(fetch).toHaveBeenCalledWith('/api/calendar/availability?month=2026-01');
      expect(data.month).toBe('2026-01');
      expect(data.days['2026-01-01'].currentUserStatus).toBe('AVAILABLE');
    });

    it('should return 400 for invalid month format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Paramètre month requis (format YYYY-MM)' }),
      });

      const response = await fetch('/api/calendar/availability?month=invalid');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should return 400 when month parameter is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Paramètre month requis (format YYYY-MM)' }),
      });

      const response = await fetch('/api/calendar/availability');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should include player availabilities for each day', async () => {
      const mockDayData: DayData = {
        date: '2026-01-15',
        currentUserStatus: null,
        playerAvailabilities: [
          { userId: 'user-1', userName: 'Alice', status: 'AVAILABLE' },
          { userId: 'user-2', userName: 'Bob', status: 'UNAVAILABLE' },
          { userId: 'user-3', userName: 'Charlie', status: null },
        ],
        events: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ month: '2026-01', days: { '2026-01-15': mockDayData } }),
      });

      const response = await fetch('/api/calendar/availability?month=2026-01');
      const data = await response.json();

      expect(data.days['2026-01-15'].playerAvailabilities).toHaveLength(3);
      expect(data.days['2026-01-15'].playerAvailabilities[0].status).toBe('AVAILABLE');
      expect(data.days['2026-01-15'].playerAvailabilities[1].status).toBe('UNAVAILABLE');
      expect(data.days['2026-01-15'].playerAvailabilities[2].status).toBeNull();
    });
  });

  describe('POST /api/calendar/availability', () => {
    it('should set availability to AVAILABLE', async () => {
      const mockAvailability = {
        id: 'avail-1',
        userId: 'user-1',
        date: '2026-01-15',
        status: 'AVAILABLE' as AvailabilityStatus,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAvailability),
      });

      const response = await fetch('/api/calendar/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-01-15', status: 'AVAILABLE' }),
      });
      const data = await response.json();

      expect(data.status).toBe('AVAILABLE');
      expect(data.date).toBe('2026-01-15');
    });

    it('should set availability to UNAVAILABLE', async () => {
      const mockAvailability = {
        id: 'avail-2',
        userId: 'user-1',
        date: '2026-01-16',
        status: 'UNAVAILABLE' as AvailabilityStatus,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAvailability),
      });

      const response = await fetch('/api/calendar/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-01-16', status: 'UNAVAILABLE' }),
      });
      const data = await response.json();

      expect(data.status).toBe('UNAVAILABLE');
    });

    it('should delete availability when status is null', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, deleted: true }),
      });

      const response = await fetch('/api/calendar/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-01-15', status: null }),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.deleted).toBe(true);
    });

    it('should return 400 for invalid date format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Date invalide (format YYYY-MM-DD requis)' }),
      });

      const response = await fetch('/api/calendar/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: 'invalid-date', status: 'AVAILABLE' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Status invalide' }),
      });

      const response = await fetch('/api/calendar/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-01-15', status: 'INVALID' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  // ===========================================
  // Event Routes Tests
  // ===========================================

  describe('GET /api/calendar/events', () => {
    it('should fetch all events for a month', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          date: '2026-01-10',
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs Team A',
          createdById: 'admin-1',
          createdAt: '2026-01-01T10:00:00Z',
        },
        {
          id: 'event-2',
          date: '2026-01-15',
          startTime: '19:00',
          endTime: '21:00',
          type: 'EVENT',
          title: 'Training Session',
          createdById: 'admin-1',
          createdAt: '2026-01-02T10:00:00Z',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const response = await fetch('/api/calendar/events?month=2026-01');
      const events = await response.json();

      expect(fetch).toHaveBeenCalledWith('/api/calendar/events?month=2026-01');
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('MATCH');
      expect(events[1].type).toBe('EVENT');
    });

    it('should return 400 for invalid month format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Paramètre month requis (format YYYY-MM)' }),
      });

      const response = await fetch('/api/calendar/events?month=2026');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/calendar/events', () => {
    it('should create a MATCH event', async () => {
      const mockEvent: CalendarEvent = {
        id: 'event-new',
        date: '2026-01-20',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH',
        title: 'Championship Match',
        description: 'Important match',
        createdById: 'admin-1',
        createdAt: '2026-01-07T10:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockEvent),
      });

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-01-20',
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Championship Match',
          description: 'Important match',
        }),
      });
      const event = await response.json();

      expect(response.status).toBe(201);
      expect(event.type).toBe('MATCH');
      expect(event.title).toBe('Championship Match');
    });

    it('should create an EVENT type event', async () => {
      const mockEvent: CalendarEvent = {
        id: 'event-new-2',
        date: '2026-01-25',
        startTime: '18:00',
        endTime: '20:00',
        type: 'EVENT',
        title: 'Team Meeting',
        createdById: 'admin-1',
        createdAt: '2026-01-07T11:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockEvent),
      });

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-01-25',
          startTime: '18:00',
          endTime: '20:00',
          type: 'EVENT',
          title: 'Team Meeting',
        }),
      });
      const event = await response.json();

      expect(response.status).toBe(201);
      expect(event.type).toBe('EVENT');
    });

    it('should return 400 for invalid date format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Date invalide (format YYYY-MM-DD requis)' }),
      });

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026/01/20',
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Test',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid time format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Heure de début invalide (format HH:mm requis)' }),
      });

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-01-20',
          startTime: '20h00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Test',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid event type', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Type invalide (MATCH ou EVENT requis)' }),
      });

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-01-20',
          startTime: '20:00',
          endTime: '22:00',
          type: 'INVALID_TYPE',
          title: 'Test',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing title', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Titre requis' }),
      });

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-01-20',
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: '',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/calendar/events/:id', () => {
    it('should delete an event', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const response = await fetch('/api/calendar/events/event-1', {
        method: 'DELETE',
      });
      const data = await response.json();

      expect(fetch).toHaveBeenCalledWith('/api/calendar/events/event-1', { method: 'DELETE' });
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent event', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Événement non trouvé' }),
      });

      const response = await fetch('/api/calendar/events/non-existent', {
        method: 'DELETE',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/calendar/events/:id', () => {
    it('should update an event', async () => {
      const updatedEvent: CalendarEvent = {
        id: 'event-1',
        date: '2026-01-20',
        startTime: '21:00',
        endTime: '23:00',
        type: 'MATCH',
        title: 'Updated Match Title',
        createdById: 'admin-1',
        createdAt: '2026-01-01T10:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedEvent),
      });

      const response = await fetch('/api/calendar/events/event-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '21:00',
          endTime: '23:00',
          title: 'Updated Match Title',
        }),
      });
      const event = await response.json();

      expect(event.title).toBe('Updated Match Title');
      expect(event.startTime).toBe('21:00');
    });

    it('should return 404 for non-existent event', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Événement non trouvé' }),
      });

      const response = await fetch('/api/calendar/events/non-existent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/calendar/events/:id/gameplan', () => {
    it('should update the game plan for a MATCH event', async () => {
      const gamePlan = {
        absentPlayerId: 'player-1',
        absentPlayerName: 'Player 1',
        maps: [
          {
            mapId: 'artefact',
            mapName: 'Artefact',
            assignments: [
              {
                visibleplayerId: 'player-2',
                visibleplayerName: 'Player 2',
                assignmentId: 1,
                assignmentName: 'Front',
                assignmentColor: '#ff0000',
              },
            ],
          },
        ],
      };

      const updatedEvent: CalendarEvent = {
        id: 'event-1',
        date: '2026-01-20',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH',
        title: 'Match with Game Plan',
        gamePlan,
        createdById: 'admin-1',
        createdAt: '2026-01-01T10:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedEvent),
      });

      const response = await fetch('/api/calendar/events/event-1/gameplan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gamePlan }),
      });
      const event = await response.json();

      expect(event.gamePlan).toBeDefined();
      expect(event.gamePlan.absentPlayerId).toBe('player-1');
      expect(event.gamePlan.maps).toHaveLength(1);
      expect(event.gamePlan.maps[0].mapId).toBe('artefact');
    });

    it('should return 404 for non-existent event', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Événement non trouvé' }),
      });

      const response = await fetch('/api/calendar/events/non-existent/gameplan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gamePlan: {} }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should return 400 when trying to add game plan to non-MATCH event', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Seuls les MATCH peuvent avoir un plan de jeu' }),
      });

      const response = await fetch('/api/calendar/events/event-type-event/gameplan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gamePlan: {} }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  // ===========================================
  // Authentication & Authorization Tests
  // ===========================================

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Non authentifié' }),
      });

      const response = await fetch('/api/calendar/availability?month=2026-01');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should return 403 when non-admin tries to create event', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Admin requis' }),
      });

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-01-20',
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Test',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });

    it('should return 403 when non-admin tries to delete event', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Admin requis' }),
      });

      const response = await fetch('/api/calendar/events/event-1', {
        method: 'DELETE',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });
  });
});

