// Players routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';

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
    console.error('Error fetching players:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;
