// Players routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as playerService from '@services/player.service';
import * as evaAccountService from '@services/eva-account.service';
import type { LinkEvaAccountRefusal } from '@services/eva-account.service';
import { parseSubscriptionInput, parseEvaUsernameInput } from '@services/helpers/validation.helper';
import { EvaApiError } from '../integrations/eva/eva-graphql';

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

// ============================================
// eva.gg account
// ============================================

// How each refused link is answered
const EVA_LINK_REFUSALS: Record<LinkEvaAccountRefusal, { status: number; error: string }> = {
  notFound: { status: 404, error: ERROR.evaPlayerNotFound },
  privateProfile: { status: 422, error: ERROR.evaProfilePrivate },
  alreadyLinked: { status: 409, error: ERROR.evaAccountAlreadyLinked },
};

// GET /api/players/me/eva-account - The eva.gg account the current player linked (null if none)
router.get('/me/eva-account', authMiddleware, async (req: AuthRequest, res: Response) => {
  const playerId = req.account?.playerId;
  if (!playerId) {
    res.status(403).json({ errors: [ERROR.playerAccountRequired] });
    return;
  }

  try {
    res.json(await evaAccountService.getEvaAccountLink(playerId));
  } catch (error) {
    apiLogger.error('Error fetching eva.gg account:', error);
    res.status(500).json({ errors: [ERROR.evaAccountFetchFailed] });
  }
});

// PUT /api/players/me/eva-account - Resolve an eva.gg tag and link that account
// to the current player, in place of the one linked before: a player changes
// it, never goes without one
router.put('/me/eva-account', authMiddleware, async (req: AuthRequest, res: Response) => {
  const playerId = req.account?.playerId;
  if (!playerId) {
    res.status(403).json({ errors: [ERROR.playerAccountRequired] });
    return;
  }

  const input = parseEvaUsernameInput(req.body);
  if ('errors' in input) {
    res.status(400).json({ errors: input.errors });
    return;
  }

  let result;
  try {
    result = await evaAccountService.linkEvaAccount(playerId, input.username);
  } catch (error) {
    apiLogger.error('Error linking eva.gg account:', error);
    // eva.gg refused or never answered (fetch itself fails with a TypeError); anything else is ours
    const isUpstream = error instanceof EvaApiError || error instanceof TypeError;
    res.status(isUpstream ? 502 : 500).json({ errors: [isUpstream ? ERROR.evaUnavailable : ERROR.evaAccountLinkFailed] });
    return;
  }

  if ('refusal' in result) {
    const { status, error } = EVA_LINK_REFUSALS[result.refusal];
    res.status(status).json({ errors: [error] });
    return;
  }
  res.json(result.link);
});

export default router;
