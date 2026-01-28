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
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;

