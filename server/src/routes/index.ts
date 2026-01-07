// Routes index - mounts all route modules

import { Router } from 'express';
import type { Request, Response } from 'express';
import authRoutes from '@routes/auth.routes';
import mapsRoutes from '@routes/maps.routes';
import plansRoutes from '@routes/plans.routes';
import usersRoutes from '@routes/users.routes';
import { prisma } from '@db/prisma';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/maps', mapsRoutes);
router.use('/plans', plansRoutes);
router.use('/users', usersRoutes);

// GET /api/players - Public endpoint for player list
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

