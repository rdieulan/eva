// Players routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR_MESSAGES } from '@shared/constants';

const router = Router();

// GET /api/players - Get players list filtered by team
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const teamId = req.user?.teamId;

  // User must belong to a team to see team players
  if (!teamId) {
    res.json([]);
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
  }
});

export default router;
