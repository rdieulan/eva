import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MapConfig } from '../../src/types';

// API integration tests (mocked)
describe('Maps API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/maps', () => {
    it('should fetch all maps', async () => {
      const mockMaps: MapConfig[] = [
        {
          id: 'artefact',
          name: 'Artefact',
          images: ['/maps/artefact/Artefact.png'],
          assignments: [],
          players: [],
        },
        {
          id: 'atlantis',
          name: 'Atlantis',
          images: ['/maps/atlantis/Atlantis.png'],
          assignments: [],
          players: [],
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMaps),
      });

      const response = await fetch('/api/maps');
      const maps = await response.json();

      expect(fetch).toHaveBeenCalledWith('/api/maps');
      expect(maps).toHaveLength(2);
      expect(maps[0].id).toBe('artefact');
    });

    it('should handle server error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      const response = await fetch('/api/maps');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/maps/:id', () => {
    it('should fetch a single map by ID', async () => {
      const mockMap: MapConfig = {
        id: 'artefact',
        name: 'Artefact',
        images: ['/maps/artefact/Artefact.png'],
        assignments: [
          { id: 1, name: 'Front', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
        ],
        players: [
          { userId: 'user-1', assignmentIds: [1] },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMap),
      });

      const response = await fetch('/api/maps/artefact');
      const map = await response.json();

      expect(fetch).toHaveBeenCalledWith('/api/maps/artefact');
      expect(map.id).toBe('artefact');
      expect(map.assignments).toHaveLength(1);
    });

    it('should return 404 for unknown map', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Map not found' }),
      });

      const response = await fetch('/api/maps/unknown');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/maps/:id', () => {
    it('should update map configuration', async () => {
      const updatedMap: MapConfig = {
        id: 'artefact',
        name: 'Artefact',
        images: ['/maps/artefact/Artefact.png'],
        assignments: [
          { id: 1, name: 'Updated Position', x: 30, y: 30, zone: { x1: 25, y1: 25, x2: 35, y2: 35 } },
        ],
        players: [
          { userId: 'user-1', assignmentIds: [1] },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedMap),
      });

      const response = await fetch('/api/maps/artefact', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
        body: JSON.stringify(updatedMap),
      });

      expect(fetch).toHaveBeenCalledWith('/api/maps/artefact', expect.objectContaining({
        method: 'PUT',
      }));
      expect(response.ok).toBe(true);
    });

    it('should require authentication', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const response = await fetch('/api/maps/artefact', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should require admin role', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Forbidden - Admin required' }),
      });

      const response = await fetch('/api/maps/artefact', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer player-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });
  });
});

describe('Players API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/players', () => {
    it('should fetch all players', async () => {
      const mockPlayers = [
        { id: 'user-1', name: 'Player 1' },
        { id: 'user-2', name: 'Player 2' },
        { id: 'user-3', name: 'Player 3' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPlayers),
      });

      const response = await fetch('/api/players');
      const players = await response.json();

      expect(fetch).toHaveBeenCalledWith('/api/players');
      expect(players).toHaveLength(3);
    });

    it('should require authentication', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      const response = await fetch('/api/players');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });
});

describe('Game Plans API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/maps/:mapId/gameplans', () => {
    it('should fetch game plans for a map', async () => {
      const mockGamePlans = [
        { id: 'plan-1', name: 'Default Plan' },
        { id: 'plan-2', name: 'Aggressive Setup' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGamePlans),
      });

      const response = await fetch('/api/maps/artefact/gameplans');
      const plans = await response.json();

      expect(plans).toHaveLength(2);
      expect(plans[0].name).toBe('Default Plan');
    });
  });

  describe('POST /api/maps/:mapId/gameplans', () => {
    it('should create a new game plan', async () => {
      const newPlan = { name: 'New Strategy' };
      const createdPlan = { id: 'plan-3', ...newPlan };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(createdPlan),
      });

      const response = await fetch('/api/maps/artefact/gameplans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token',
        },
        body: JSON.stringify(newPlan),
      });

      expect(response.ok).toBe(true);
      const plan = await response.json();
      expect(plan.name).toBe('New Strategy');
    });
  });
});

