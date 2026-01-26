// Maps routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { DEFAULT_GAME_PLAN_NOTES } from '@shared/constants';

const router = Router();

/**
 * Transform GamePlanPlayer array for frontend consumption
 */
function mapPlayersForFrontend(players: { userId: string; assignmentIds: number[]; mainAssignmentId: number | null }[]) {
  return players.map(p => ({
    userId: p.userId,
    assignmentIds: p.assignmentIds,
    mainAssignmentId: p.mainAssignmentId,
  }));
}

// GET /api/maps - Get all maps
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const teamId = req.user?.teamId;

  if (!teamId) {
    res.status(403).json({ errors: ['Vous devez appartenir à une équipe pour accéder aux cartes'] });
    return;
  }

  console.log('[API] GET /api/maps for team:', teamId);

  try {
    const maps = await prisma.map.findMany({
      orderBy: { name: 'asc' },
      include: {
        gamePlans: {
          where: { teamId },
          include: { players: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    // Transform for frontend - include full plan data
    const mapsForFrontend = maps.map(map => {
      const firstPlan = map.gamePlans[0];
      const assignments = firstPlan?.assignments as unknown[] || [];
      const players = firstPlan ? mapPlayersForFrontend(firstPlan.players) : [];

      // Include full data for each game plan
      const gamePlansWithData = map.gamePlans.map(gp => ({
        id: gp.id,
        name: gp.name,
        assignments: gp.assignments,
        players: mapPlayersForFrontend(gp.players),
        notes: gp.notes || DEFAULT_GAME_PLAN_NOTES,
      }));

      return {
        id: map.id,
        name: map.name,
        images: map.images as string[],
        assignments,
        players,
        gamePlans: gamePlansWithData,
        notes: firstPlan?.notes || DEFAULT_GAME_PLAN_NOTES,
      };
    });

    console.log('[API] Returning', mapsForFrontend.length, 'maps');
    res.json(mapsForFrontend);
  } catch (error) {
    console.error('[API] Error fetching maps:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// GET /api/maps/:mapId - Get a specific map
router.get('/:mapId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const teamId = req.user?.teamId;

  if (!teamId) {
    res.status(403).json({ errors: ['Vous devez appartenir à une équipe pour accéder aux cartes'] });
    return;
  }

  console.log('[API] GET /api/maps/' + mapId + ' for team:', teamId);

  try {
    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        gamePlans: {
          where: { teamId },
          include: { players: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!map) {
      console.log('[API] Map not found:', mapId);
      res.status(404).json({ errors: ['Carte non trouvée'] });
      return;
    }

    const firstPlan = map.gamePlans[0];
    const assignments = firstPlan?.assignments as unknown[] || [];
    const players = firstPlan ? mapPlayersForFrontend(firstPlan.players) : [];

    const mapForFrontend = {
      id: map.id,
      name: map.name,
      images: map.images as string[],
      assignments,
      players,
      gamePlans: map.gamePlans.map(gp => ({ id: gp.id, name: gp.name })),
      notes: firstPlan?.notes || DEFAULT_GAME_PLAN_NOTES,
    };

    console.log('[API] Returning map with', players.length, 'players');
    res.json(mapForFrontend);
  } catch (error) {
    console.error('[API] Error fetching map:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// POST /api/maps/:mapId - Update map metadata and template
router.post('/:mapId', authMiddleware, requirePermission('planner', 'canEdit'), async (req: AuthRequest, res: Response) => {
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
    res.json({ success: true, message: `Carte ${mapId} sauvegardée` });
  } catch (error) {
    console.error('Error saving map:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// GET /api/maps/:mapId/plans - Get all game plans for a map
router.get('/:mapId/plans', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const teamId = req.user?.teamId;

  if (!teamId) {
    res.status(403).json({ errors: ['Vous devez appartenir à une équipe pour accéder aux plans'] });
    return;
  }

  try {
    const plans = await prisma.gamePlan.findMany({
      where: {
        mapId,
        teamId,
      },
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
      players: mapPlayersForFrontend(plan.players),
      notes: plan.notes || DEFAULT_GAME_PLAN_NOTES,
    }));

    res.json(plansForFrontend);
  } catch (error) {
    console.error('Error fetching game plans:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// POST /api/maps/:mapId/plans - Create a new game plan
router.post('/:mapId/plans', authMiddleware, requirePermission('planner', 'canCreate'), async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const { name } = req.body;
  const teamId = req.user?.teamId;

  if (!teamId) {
    res.status(400).json({ errors: ['L\'utilisateur doit appartenir à une équipe pour créer un plan'] });
    return;
  }

  try {
    const map = await prisma.map.findUnique({ where: { id: mapId } });
    if (!map) {
      res.status(404).json({ errors: ['Carte non trouvée'] });
      return;
    }

    const template = map.template as { assignments: object[] };

    const plan = await prisma.gamePlan.create({
      data: {
        name: name || 'Nouveau plan',
        mapId,
        teamId,
        assignments: template?.assignments || [],
      },
    });

    console.log(`Game plan created by ${req.user?.email}: ${plan.id} for map ${mapId}`);
    res.json(plan);
  } catch (error) {
    console.error('Error creating game plan:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

export default router;
