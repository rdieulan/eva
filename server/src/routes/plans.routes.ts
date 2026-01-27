// Game Plans routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import * as plansService from '@services/plans.service';

const router = Router();

// GET /api/plans/:planId - Get a specific game plan
router.get('/:planId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;
  const teamId = req.user?.teamId;

  try {
    const result = await plansService.getPlanById(planId, teamId || undefined);

    if (!result) {
      res.status(404).json({ errors: ['Plan not found'] });
      return;
    }

    if ('accessDenied' in result) {
      res.status(403).json({ errors: ['Access denied'] });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching game plan:', error);
    res.status(500).json({ errors: ['Server error'] });
  }
});

// PUT /api/plans/:planId - Update a game plan
router.put('/:planId', authMiddleware, requirePermission('planner', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;
  const { name, assignments, players, notes } = req.body;
  const teamId = req.user?.teamId;

  console.log(`[API] PUT /api/plans/${planId}`);
  console.log('[API] User:', req.user?.email);

  try {
    const result = await plansService.updatePlan(
      planId,
      { name, assignments, players, notes },
      teamId || undefined
    );

    if (!result.success) {
      const status = result.error === 'Access denied' ? 403 : 404;
      res.status(status).json({ errors: [result.error] });
      return;
    }

    console.log(`[API] Game plan updated by ${req.user?.email}: ${planId}`);
    res.json(result.plan);
  } catch (error) {
    console.error('[API] Error updating game plan:', error);
    res.status(500).json({ errors: ['Server error'] });
  }
});

// DELETE /api/plans/:planId - Delete a game plan
router.delete('/:planId', authMiddleware, requirePermission('planner', 'canDelete'), async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;
  const teamId = req.user?.teamId;

  try {
    const result = await plansService.deletePlan(planId, teamId || undefined);

    if (!result.success) {
      const status = result.error === 'Access denied' ? 403 : 404;
      res.status(status).json({ errors: [result.error] });
      return;
    }

    console.log(`Game plan deleted by ${req.user?.email}: ${planId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting game plan:', error);
    res.status(500).json({ errors: ['Server error'] });
  }
});

export default router;
