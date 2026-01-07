// Tests for Calendar API client
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchMonthData,
  setAvailability,
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventGamePlan,
} from '@/api/calendar.api';
import type { MonthData, CalendarEvent, MatchGamePlan } from '@shared/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('Calendar API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchMonthData', () => {
    it('should fetch month data successfully', async () => {
      const mockData: MonthData = {
        month: '2026-01',
        days: {
          '2026-01-01': {
            date: '2026-01-01',
            currentUserStatus: null,
            playerAvailabilities: [],
            events: [],
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchMonthData('2026-01');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calendar/availability?month=2026-01',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should throw error on failed request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(fetchMonthData('2026-01')).rejects.toThrow('Unauthorized');
    });
  });

  describe('setAvailability', () => {
    it('should set availability to AVAILABLE', async () => {
      const mockResponse = {
        id: 'avail-1',
        userId: 'user-1',
        date: '2026-01-15',
        status: 'AVAILABLE',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await setAvailability('2026-01-15', 'AVAILABLE');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calendar/availability',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ date: '2026-01-15', status: 'AVAILABLE' }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should remove availability when status is null', async () => {
      const mockResponse = { success: true, deleted: true };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await setAvailability('2026-01-15', null);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calendar/availability',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ date: '2026-01-15', status: null }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed availability update', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid date' }),
      });

      await expect(setAvailability('invalid-date', 'AVAILABLE')).rejects.toThrow('Invalid date');
    });
  });

  describe('fetchEvents', () => {
    it('should fetch events for a month', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          date: '2026-01-20',
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs Team X',
          createdById: 'admin-1',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvents,
      });

      const result = await fetchEvents('2026-01');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calendar/events?month=2026-01',
        expect.any(Object)
      );
      expect(result).toEqual(mockEvents);
    });
  });

  describe('createEvent', () => {
    it('should create a new event', async () => {
      const newEvent = {
        date: '2026-01-25',
        startTime: '19:00',
        endTime: '21:00',
        type: 'MATCH' as const,
        title: 'Important Match',
        description: 'Final match',
      };

      const mockResponse: CalendarEvent = {
        id: 'event-new',
        ...newEvent,
        createdById: 'admin-1',
        createdAt: '2026-01-01T00:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createEvent(newEvent);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calendar/events',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newEvent),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event', async () => {
      const updateData = {
        date: '2026-01-25',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH' as const,
        title: 'Updated Match',
      };

      const mockResponse: CalendarEvent = {
        id: 'event-1',
        ...updateData,
        createdById: 'admin-1',
        createdAt: '2026-01-01T00:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await updateEvent('event-1', updateData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calendar/events/event-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await deleteEvent('event-1');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calendar/events/event-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('updateEventGamePlan', () => {
    it('should update game plan for a match', async () => {
      const gamePlan: MatchGamePlan = {
        absentPlayerId: 'player-1',
        absentPlayerName: 'Alice',
        maps: [
          {
            mapId: 'map-1',
            mapName: 'Polaris',
            assignments: [
              {
                visibleplayerId: 'player-2',
                visibleplayerName: 'Bob',
                assignmentId: 1,
                assignmentName: 'Pilote',
                assignmentColor: '#FF0000',
              },
            ],
          },
        ],
      };

      const mockResponse: CalendarEvent = {
        id: 'event-1',
        date: '2026-01-25',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH',
        title: 'Match',
        gamePlan,
        createdById: 'admin-1',
        createdAt: '2026-01-01T00:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await updateEventGamePlan('event-1', gamePlan);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/calendar/events/event-1/gameplan',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ gamePlan }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });
});

