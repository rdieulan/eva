// Routes index - mounts all route modules

import { Router } from 'express';
import type { Request, Response } from 'express';
import authRoutes from '@routes/auth.routes';
import mapsRoutes from '@routes/maps.routes';
import plansRoutes from '@routes/plans.routes';
import usersRoutes from '@routes/users.routes';
import calendarRoutes from '@routes/calendar.routes';
import teamsRoutes from '@routes/teams.routes';
import balanceRulesRoutes from '@routes/balance-rules.routes';
import { prisma, pool } from '@db/prisma';

const router = Router();

// Health check endpoint for monitoring
router.get('/health', async (_req: Request, res: Response) => {
  const healthcheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: 'unknown',
      poolTotal: 0,
      poolIdle: 0,
      poolWaiting: 0,
    },
  };

  try {
    // Test database connection
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;

    healthcheck.database = {
      status: 'connected',
      poolTotal: pool.totalCount,
      poolIdle: pool.idleCount,
      poolWaiting: pool.waitingCount,
    };

    console.log(`[HEALTH] Check passed - DB response time: ${responseTime}ms, Pool: ${pool.totalCount} total, ${pool.idleCount} idle`);
    res.json({ ...healthcheck, dbResponseTime: responseTime });
  } catch (error) {
    const err = error as Error;
    console.error('[HEALTH] Database health check failed:', err.message);

    healthcheck.status = 'degraded';
    healthcheck.database.status = 'disconnected';

    res.status(503).json({
      ...healthcheck,
      error: err.message,
    });
  }
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/maps', mapsRoutes);
router.use('/plans', plansRoutes);
router.use('/users', usersRoutes);
router.use('/calendar', calendarRoutes);
router.use('/teams', teamsRoutes);
router.use('/balance-rules', balanceRulesRoutes);

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

