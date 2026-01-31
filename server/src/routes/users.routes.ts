// Users routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';

const router = Router();

// GET /api/users - Get all users (team management permission required)
router.get('/', authMiddleware, requirePermission('team', 'canManagePermissions'), async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;

  // Account must belong to a team to see team members
  if (!teamId) {
    res.json([]);
    return;
  }

  try {
    const players = await prisma.player.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });
    // Return format compatible with frontend
    res.json(players.map(p => ({
      id: p.user!.id,
      email: p.user!.email,
      name: p.user!.name,
      permissions: p.permissions,
      teamId: p.teamId,
      createdAt: p.user!.createdAt,
    })));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;

