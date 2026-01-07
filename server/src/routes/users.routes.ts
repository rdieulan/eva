// Users routes

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// GET /api/users - Get all users (admin only)
router.get('/', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/players - Get players list (public - for frontend player selection)
router.get('/players', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

