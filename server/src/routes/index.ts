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
import invitesRoutes from '@routes/invites.routes';
import playersRoutes from '@routes/players.routes';
import venuesRoutes from '@routes/venues.routes';
import { prisma, pool } from '@db/prisma';
import { logger } from '@utils/logger';

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

    logger.info(`[HEALTH] Check passed - DB response time: ${responseTime}ms, Pool: ${pool.totalCount} total, ${pool.idleCount} idle`);
    res.json({ ...healthcheck, dbResponseTime: responseTime });
  } catch (error) {
    const err = error as Error;
    logger.error('[HEALTH] Database health check failed:', err.message);

    healthcheck.status = 'degraded';
    healthcheck.database.status = 'disconnected';

    res.status(503).json({
      ...healthcheck,
      errors: [err.message],
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
router.use('/players', playersRoutes);
router.use('/venues', venuesRoutes);
router.use('/', invitesRoutes); // Handles /teams/:teamId/invites and /invites/:code

export default router;
