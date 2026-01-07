// Maps routes

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// GET /api/maps - Get all maps
router.get('/', async (_req: Request, res: Response) => {
  console.log('[API] GET /api/maps');
  try {
    const maps = await prisma.map.findMany({
      orderBy: { name: 'asc' },
      include: {
        gamePlans: {
          include: { players: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    // Transform for frontend - use first GamePlan's data
    const mapsForFrontend = maps.map(map => {
      const firstPlan = map.gamePlans[0];
      const assignments = firstPlan?.assignments as unknown[] || [];
      const players = firstPlan?.players.map(gpp => ({
        userId: gpp.userId,
        assignmentIds: gpp.assignmentIds,
      })) || [];

      return {
        id: map.id,
        name: map.name,
        images: map.images as string[],
        assignments,
        players,
        gamePlans: map.gamePlans.map(gp => ({ id: gp.id, name: gp.name })),
      };
    });

    console.log('[API] Returning', mapsForFrontend.length, 'maps');
    res.json(mapsForFrontend);
  } catch (error) {
    console.error('[API] Error fetching maps:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/maps/:mapId - Get a specific map
router.get('/:mapId', async (req: Request, res: Response) => {
  const { mapId } = req.params;
  console.log('[API] GET /api/maps/' + mapId);

  try {
    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        gamePlans: {
          include: { players: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!map) {
      console.log('[API] Map not found:', mapId);
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    const firstPlan = map.gamePlans[0];
    const assignments = firstPlan?.assignments as unknown[] || [];
    const players = firstPlan?.players.map(gpp => ({
      userId: gpp.userId,
      assignmentIds: gpp.assignmentIds,
    })) || [];

    const mapForFrontend = {
      id: map.id,
      name: map.name,
      images: map.images as string[],
      assignments,
      players,
      gamePlans: map.gamePlans.map(gp => ({ id: gp.id, name: gp.name })),
    };

    console.log('[API] Returning map with', players.length, 'players');
    res.json(mapForFrontend);
  } catch (error) {
    console.error('[API] Error fetching map:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/maps/:mapId - Update map metadata and template (admin only)
router.post('/:mapId', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const { name, images, template } = req.body;

  try {
    await prisma.map.upsert({
      where: { id: mapId },
      update: {
        ...(name && { name }),
        ...(images && { images }),
        ...(template && { template: JSON.parse(JSON.stringify(template)) }),
      },
      create: {
        id: mapId,
        name: name || mapId,
        images: images || [],
        template: template || { assignments: [] },
      },
    });

    console.log(`Map updated by ${req.user?.email}: ${mapId}`);
    res.json({ success: true, message: `Map ${mapId} saved` });
  } catch (error) {
    console.error('Error saving map:', error);
    res.status(500).json({ success: false, message: 'Error saving map' });
  }
});

// GET /api/maps/:mapId/plans - Get all game plans for a map
router.get('/:mapId/plans', async (req: Request, res: Response) => {
  const { mapId } = req.params;

  try {
    const plans = await prisma.gamePlan.findMany({
      where: { mapId },
      orderBy: { name: 'asc' },
      include: {
        players: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    const plansForFrontend = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      mapId: plan.mapId,
      assignments: plan.assignments,
      players: plan.players.map(gpp => ({
        userId: gpp.userId,
        assignmentIds: gpp.assignmentIds,
      })),
    }));

    res.json(plansForFrontend);
  } catch (error) {
    console.error('Error fetching game plans:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/maps/:mapId/plans - Create a new game plan (admin only)
router.post('/:mapId/plans', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const { name } = req.body;

  try {
    const map = await prisma.map.findUnique({ where: { id: mapId } });
    if (!map) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    const template = map.template as { assignments: object[] };

    const plan = await prisma.gamePlan.create({
      data: {
        name: name || 'Nouveau plan',
        mapId,
        assignments: template?.assignments || [],
      },
    });

    console.log(`Game plan created by ${req.user?.email}: ${plan.id} for map ${mapId}`);
    res.json(plan);
  } catch (error) {
    console.error('Error creating game plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
