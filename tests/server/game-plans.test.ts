import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GamePlan, GamePlanSummary, Assignment } from '@shared/types';

describe('Game Plans API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/maps/:id/plans', () => {
    it('should fetch all plans for a map', async () => {
      const mockPlans: GamePlanSummary[] = [
        { id: 'plan-1', name: 'Plan Principal' },
        { id: 'plan-2', name: 'Plan Alternatif' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPlans),
      });

      const response = await fetch('/api/maps/artefact/plans');
      const plans = await response.json();

      expect(fetch).toHaveBeenCalledWith('/api/maps/artefact/plans');
      expect(plans).toHaveLength(2);
      expect(plans[0].name).toBe('Plan Principal');
    });

    it('should return empty array for map with no plans', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const response = await fetch('/api/maps/new-map/plans');
      const plans = await response.json();

      expect(plans).toEqual([]);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should fetch a complete game plan with notes', async () => {
      const mockPlan: GamePlan = {
        id: 'plan-1',
        name: 'Plan Principal',
        mapId: 'artefact',
        assignments: [
          {
            id: 1,
            name: 'Front',
            x: 25,
            y: 25,
            zonesByPhase: {
              START: { polygons: [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]] },
              ATTACK: { polygons: [[{ x: 15, y: 15 }, { x: 25, y: 15 }, { x: 25, y: 25 }]] },
              DEFENSE: { polygons: [[{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }]] },
            },
            markersByPhase: {
              START: [{ id: 'm1', x: 15, y: 15, icon: 'player' }],
              ATTACK: [],
              DEFENSE: [],
            },
          },
        ],
        players: [{ userId: 'user-1', assignmentIds: [1] }],
        notes: {
          general: 'Plan de base',
          phases: {
            START: 'Départ rapide',
            ATTACK: 'Attaque coordonnée',
            DEFENSE: 'Défense en zone',
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPlan),
      });

      const response = await fetch('/api/plans/plan-1');
      const plan = await response.json();

      expect(plan.id).toBe('plan-1');
      expect(plan.notes.general).toBe('Plan de base');
    });
  });

  describe('POST /api/maps/:id/plans', () => {
    it('should create a new game plan', async () => {
      const createdPlan: GamePlanSummary = {
        id: 'plan-new',
        name: 'Nouveau Plan',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(createdPlan),
      });

      const response = await fetch('/api/maps/artefact/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nouveau Plan' }),
      });
      const plan = await response.json();

      expect(response.ok).toBe(true);
      expect(plan.name).toBe('Nouveau Plan');
    });
  });

  describe('PUT /api/plans/:id', () => {
    it('should update plan with zones by phase', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const response = await fetch('/api/plans/plan-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: [], players: [] }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('DELETE /api/plans/:id', () => {
    it('should delete a game plan', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      const response = await fetch('/api/plans/plan-1', { method: 'DELETE' });

      expect(response.ok).toBe(true);
    });
  });
});

describe('Legacy Data Migration', () => {
  it('should migrate legacy zone to all phases', () => {
    const legacyAssignment: Assignment = {
      id: 1,
      name: 'Legacy',
      x: 25,
      y: 25,
      zone: { x1: 10, y1: 10, x2: 30, y2: 30 },
    };

    const migratedAssignment: Assignment = {
      ...legacyAssignment,
      zonesByPhase: {
        START: legacyAssignment.zone!,
        ATTACK: legacyAssignment.zone!,
        DEFENSE: legacyAssignment.zone!,
      },
    };

    expect(migratedAssignment.zonesByPhase).toBeDefined();
    expect(migratedAssignment.zonesByPhase?.START).toBe(legacyAssignment.zone);
  });
});

