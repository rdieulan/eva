// Game Plans routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import * as plansService from '@services/plans.service';

const router = Router();

// GET /api/plans/:planId - Get a specific game plan
router.get('/:planId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;
  const teamId = req.account?.teamId;

  try {
    const result = await plansService.getPlanById(planId, teamId || undefined);

    if (!result) {
      res.status(404).json({ errors: [ERROR.planNotFound] });
      return;
    }

    if ('accessDenied' in result) {
      res.status(403).json({ errors: [ERROR.accessDenied] });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching game plan:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// PUT /api/plans/:planId - Update a game plan
router.put('/:planId', authMiddleware, requirePermission('planner', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;
  const { name, assignments, players, notes } = req.body;
  const teamId = req.account?.teamId;

  console.log(`[API] PUT /api/plans/${planId}`);
  console.log('[API] Account:', req.account?.email);

  try {
    const result = await plansService.updatePlan(
      planId,
      { name, assignments, players, notes },
      teamId || undefined
    );

    if (!result.success) {
      const status = result.error === ERROR.accessDenied ? 403 : 404;
      res.status(status).json({ errors: [result.error] });
      return;
    }

    console.log(`[API] Game plan updated by ${req.account?.email}: ${planId}`);
    res.json(result.plan);
  } catch (error) {
    console.error('[API] Error updating game plan:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// DELETE /api/plans/:planId - Delete a game plan
router.delete('/:planId', authMiddleware, requirePermission('planner', 'canDelete'), async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;
  const teamId = req.account?.teamId;

  try {
    const result = await plansService.deletePlan(planId, teamId || undefined);

    if (!result.success) {
      const status = result.error === ERROR.accessDenied ? 403 : 404;
      res.status(status).json({ errors: [result.error] });
      return;
    }

    console.log(`Game plan deleted by ${req.account?.email}: ${planId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting game plan:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;
