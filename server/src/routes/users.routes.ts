// Users routes

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';

const router = Router();

// GET /api/users - Get all users (team management permission required)
router.get('/', authMiddleware, requirePermission('team', 'canManagePermissions'), async (req: AuthRequest, res: Response) => {
  const teamId = req.user?.teamId;

  // User must belong to a team to see team members
  if (!teamId) {
    res.json([]);
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: { teamId },
      select: {
        id: true,
        email: true,
        name: true,
        permissions: true,
        teamId: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ errors: ['Server error'] });
  }
});

// GET /api/players - Get players list (for frontend player selection, filtered by team)
router.get('/players', authMiddleware, async (req: AuthRequest, res: Response) => {
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
    res.status(500).json({ errors: ['Server error'] });
  }
});

export default router;

