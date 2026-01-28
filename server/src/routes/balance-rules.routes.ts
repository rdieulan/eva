// Balance rules routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import * as balanceRulesService from '@services/balance-rules.service';

const router = Router();

// GET /api/balance-rules - Get team's balance rules
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const teamId = req.user?.teamId;

  if (!teamId) {
    return res.status(404).json({ errors: [ERROR.teamNotFound] });
  }

  try {
    const rules = await balanceRulesService.getTeamRules(teamId);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching balance rules:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// PUT /api/balance-rules/:ruleId - Update a balance rule
router.put(
  '/:ruleId',
  authMiddleware,
  requirePermission('planner', 'canManageBalanceRules'),
  async (req: AuthRequest, res: Response) => {
    const { ruleId } = req.params;
    const { severity, enabled, params } = req.body;
    const teamId = req.user?.teamId;

    if (!teamId) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    try {
      const updatedRule = await balanceRulesService.updateRule(ruleId, teamId, {
        severity,
        enabled,
        params,
      });

      if (!updatedRule) {
        return res.status(404).json({ errors: [ERROR.ruleNotFound] });
      }

      res.json(updatedRule);
    } catch (error) {
      console.error('Error updating balance rule:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
    }
  }
);

// POST /api/balance-rules/reset - Reset rules to defaults
router.post(
  '/reset',
  authMiddleware,
  requirePermission('planner', 'canManageBalanceRules'),
  async (req: AuthRequest, res: Response) => {
    const teamId = req.user?.teamId;

    if (!teamId) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    try {
      const rules = await balanceRulesService.resetRules(teamId);
      res.json(rules);
    } catch (error) {
      console.error('Error resetting balance rules:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
    }
  }
);

export default router;
