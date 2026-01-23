// Game Plans routes

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { DEFAULT_GAME_PLAN_NOTES } from '@shared/constants';

const router = Router();

// GET /api/plans/:planId - Get a specific game plan
router.get('/:planId', async (req: Request, res: Response) => {
  const { planId } = req.params;

  try {
    const plan = await prisma.gamePlan.findUnique({
      where: { id: planId },
      include: {
        map: true,
        players: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    const playerAssignments = plan.players.map(gpp => ({
      userId: gpp.userId,
      assignmentIds: gpp.assignmentIds,
      mainAssignmentId: gpp.mainAssignmentId,
    }));

    res.json({
      id: plan.map.id,
      name: plan.map.name,
      images: plan.map.images,
      assignments: plan.assignments,
      players: playerAssignments,
      planId: plan.id,
      planName: plan.name,
      notes: plan.notes || DEFAULT_GAME_PLAN_NOTES,
    });
  } catch (error) {
    console.error('Error fetching game plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: Migrate legacy zone to zonesByPhase
interface Assignment {
  id: number;
  name: string;
  x: number;
  y: number;
  zone?: object;
  zonesByPhase?: Record<string, object>;
  floor?: number;
}

function migrateAssignmentsToPhases(assignments: Assignment[]): Assignment[] {
  return assignments.map(assignment => {
    // Already migrated
    if (assignment.zonesByPhase) {
      return assignment;
    }
    // Has legacy zone - migrate it
    if (assignment.zone) {
      return {
        ...assignment,
        zonesByPhase: {
          START: JSON.parse(JSON.stringify(assignment.zone)),
          ATTACK: JSON.parse(JSON.stringify(assignment.zone)),
          DEFENSE: JSON.parse(JSON.stringify(assignment.zone)),
        },
        zone: undefined,
      };
    }
    // No zone at all
    return assignment;
  });
}

// PUT /api/plans/:planId - Update a game plan
router.put('/:planId', authMiddleware, requirePermission('planner', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;
  const { name, assignments, players, notes } = req.body;

  console.log(`[API] PUT /api/plans/${planId}`);
  console.log('[API] User:', req.user?.email);

  try {
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;

    // Migrate legacy zones if assignments provided
    if (assignments !== undefined) {
      const migratedAssignments = migrateAssignmentsToPhases(assignments as Assignment[]);
      updateData.assignments = JSON.parse(JSON.stringify(migratedAssignments));
      console.log('[API] Assignments migrated to phase-based zones');
    }

    if (notes !== undefined) {
      updateData.notes = JSON.parse(JSON.stringify(notes));
    }

    const plan = await prisma.gamePlan.update({
      where: { id: planId },
      data: updateData,
    });

    // Update player assignments if provided
    if (players !== undefined && Array.isArray(players)) {
      console.log('[API] Updating player assignments...');

      await prisma.gamePlanPlayer.deleteMany({
        where: { gamePlanId: planId },
      });

      for (const playerAssignment of players as { userId: string; assignmentIds: number[]; mainAssignmentId?: number }[]) {
        if (playerAssignment.userId && playerAssignment.assignmentIds?.length > 0) {
          await prisma.gamePlanPlayer.create({
            data: {
              gamePlanId: planId,
              userId: playerAssignment.userId,
              assignmentIds: playerAssignment.assignmentIds,
              mainAssignmentId: playerAssignment.mainAssignmentId ?? null,
            },
          });
        }
      }
      console.log('[API] Player assignments updated');
    }

    console.log(`[API] Game plan updated by ${req.user?.email}: ${planId}`);
    res.json(plan);
  } catch (error) {
    console.error('[API] Error updating game plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/plans/:planId - Delete a game plan
router.delete('/:planId', authMiddleware, requirePermission('planner', 'canDelete'), async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;

  try {
    const plan = await prisma.gamePlan.findUnique({ where: { id: planId } });
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    await prisma.gamePlan.delete({ where: { id: planId } });

    console.log(`Game plan deleted by ${req.user?.email}: ${planId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting game plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
