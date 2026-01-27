// Balance rules routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { DEFAULT_BALANCE_RULES } from '@shared/types';

const router = Router();

// GET /api/balance-rules - Get team's balance rules
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { team: true },
    });

    if (!user?.team) {
      return res.status(404).json({ errors: ['Aucune équipe trouvée'] });
    }

    let rules = await prisma.balanceRule.findMany({
      where: { teamId: user.team.id },
      orderBy: { ruleKey: 'asc' },
    });

    // If no rules exist, create defaults
    if (rules.length === 0) {
      const createdRules = await prisma.$transaction(
        DEFAULT_BALANCE_RULES.map(rule =>
          prisma.balanceRule.create({
            data: {
              teamId: user.team!.id,
              ruleKey: rule.ruleKey,
              name: rule.name,
              description: rule.description,
              severity: rule.severity,
              enabled: rule.enabled,
              params: rule.params as object | undefined,
            },
          })
        )
      );
      rules = createdRules;
    }

    res.json(rules);
  } catch (error) {
    console.error('Error fetching balance rules:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
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

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { team: true },
      });

      if (!user?.team) {
        return res.status(404).json({ errors: ['Aucune équipe trouvée'] });
      }

      // Verify rule belongs to user's team
      const rule = await prisma.balanceRule.findUnique({
        where: { id: ruleId },
      });

      if (!rule || rule.teamId !== user.team.id) {
        return res.status(404).json({ errors: ['Règle non trouvée'] });
      }

      const updatedRule = await prisma.balanceRule.update({
        where: { id: ruleId },
        data: {
          ...(severity !== undefined && { severity }),
          ...(enabled !== undefined && { enabled }),
          ...(params !== undefined && { params }),
        },
      });

      res.json(updatedRule);
    } catch (error) {
      console.error('Error updating balance rule:', error);
      res.status(500).json({ errors: ['Erreur serveur'] });
    }
  }
);

// POST /api/balance-rules/reset - Reset rules to defaults
router.post(
  '/reset',
  authMiddleware,
  requirePermission('planner', 'canManageBalanceRules'),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { team: true },
      });

      if (!user?.team) {
        return res.status(404).json({ errors: ['Aucune équipe trouvée'] });
      }

      // Delete all existing rules
      await prisma.balanceRule.deleteMany({
        where: { teamId: user.team.id },
      });

      // Create default rules
      const rules = await prisma.$transaction(
        DEFAULT_BALANCE_RULES.map(rule =>
          prisma.balanceRule.create({
            data: {
              teamId: user.team!.id,
              ruleKey: rule.ruleKey,
              name: rule.name,
              description: rule.description,
              severity: rule.severity,
              enabled: rule.enabled,
              params: rule.params as object | undefined,
            },
          })
        )
      );

      res.json(rules);
    } catch (error) {
      console.error('Error resetting balance rules:', error);
      res.status(500).json({ errors: ['Erreur serveur'] });
    }
  }
);

export default router;
