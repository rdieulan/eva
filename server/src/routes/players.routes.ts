// Players routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as playerService from '@services/player.service';
import { parseSubscriptionInput } from '@services/helpers/validation.helper';

const router = Router();

// GET /api/players - Get players list filtered by team
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;

  // Account must belong to a team to see team players
  if (!teamId) {
    res.json([]);
    return;
  }

  try {
    const players = await prisma.player.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });
    // Return format compatible with frontend (using user.id and user.name)
    res.json(players.map(p => ({
      id: p.user!.id,
      name: p.user!.name,
    })));
  } catch (error) {
    apiLogger.error('Error fetching players:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/players/me/subscription - Subscription the current player entered in their profile
router.get('/me/subscription', authMiddleware, async (req: AuthRequest, res: Response) => {
  const playerId = req.account?.playerId;
  if (!playerId) {
    res.status(403).json({ errors: [ERROR.playerAccountRequired] });
    return;
  }

  try {
    const subscription = await playerService.getPlayerSubscription(playerId);
    if (!subscription) {
      res.status(404).json({ errors: [ERROR.playerNotFound] });
      return;
    }
    res.json(subscription);
  } catch (error) {
    apiLogger.error('Error fetching subscription:', error);
    res.status(500).json({ errors: [ERROR.subscriptionFetchFailed] });
  }
});

// PUT /api/players/me/subscription - Replace the current player's subscription (null clears a field)
router.put('/me/subscription', authMiddleware, async (req: AuthRequest, res: Response) => {
  const playerId = req.account?.playerId;
  if (!playerId) {
    res.status(403).json({ errors: [ERROR.playerAccountRequired] });
    return;
  }

  const input = parseSubscriptionInput(req.body);
  if ('errors' in input) {
    res.status(400).json({ errors: input.errors });
    return;
  }

  try {
    const subscription = await playerService.updatePlayerSubscription(playerId, input.subscription);
    res.json(subscription);
  } catch (error) {
    apiLogger.error('Error updating subscription:', error);
    res.status(500).json({ errors: [ERROR.subscriptionUpdateFailed] });
  }
});

export default router;
