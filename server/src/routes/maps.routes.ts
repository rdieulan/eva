// Maps routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as mapsService from '@services/maps.service';

const router = Router();

// GET /api/maps - Get all maps
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;

  if (!teamId) {
    res.status(403).json({ errors: [ERROR.teamRequiredForMaps] });
    return;
  }

  apiLogger.debug('GET /api/maps for team:', teamId);

  try {
    const maps = await mapsService.getAllMapsForTeam(teamId);
    apiLogger.debug('Returning', maps.length, 'maps');
    res.json(maps);
  } catch (error) {
    apiLogger.error('Error fetching maps:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/maps/:mapId - Get a specific map
router.get('/:mapId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const teamId = req.account?.teamId;

  if (!teamId) {
    res.status(403).json({ errors: [ERROR.teamRequiredForMaps] });
    return;
  }

  apiLogger.debug('GET /api/maps/' + mapId + ' for team:', teamId);

  try {
    const map = await mapsService.getMapForTeam(mapId, teamId);

    if (!map) {
      apiLogger.debug('Map not found:', mapId);
      res.status(404).json({ errors: [ERROR.mapNotFound] });
      return;
    }

    apiLogger.debug('Returning map with', map.players.length, 'players');
    res.json(map);
  } catch (error) {
    apiLogger.error('Error fetching map:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/maps/:mapId - Update map metadata and template
router.post('/:mapId', authMiddleware, requirePermission('planner', 'canEdit'), async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const { name, images, template } = req.body;

  try {
    await mapsService.upsertMap(mapId, { name, images, template });
    apiLogger.debug(`Map updated by ${req.account?.email}: ${mapId}`);
    res.json({ success: true, message: `Carte ${mapId} sauvegardée` });
  } catch (error) {
    apiLogger.error('Error saving map:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/maps/:mapId/plans - Get all game plans for a map
router.get('/:mapId/plans', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const teamId = req.account?.teamId;

  if (!teamId) {
    res.status(403).json({ errors: [ERROR.teamRequiredForPlans] });
    return;
  }

  try {
    const plans = await mapsService.getPlansForMapAndTeam(mapId, teamId);
    res.json(plans);
  } catch (error) {
    apiLogger.error('Error fetching game plans:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/maps/:mapId/plans - Create a new game plan
router.post('/:mapId/plans', authMiddleware, requirePermission('planner', 'canCreate'), async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const { name } = req.body;
  const teamId = req.account?.teamId;

  if (!teamId) {
    res.status(400).json({ errors: [ERROR.teamRequiredForPlans] });
    return;
  }

  try {
    const plan = await mapsService.createGamePlan(mapId, teamId, name);

    if (!plan) {
      res.status(404).json({ errors: [ERROR.mapNotFound] });
      return;
    }


    apiLogger.debug(`Game plan created by ${req.account?.email}: ${plan.id} for map ${mapId}`);
    res.json(plan);
  } catch (error) {
    apiLogger.error('Error creating game plan:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;
