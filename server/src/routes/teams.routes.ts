// Team routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { AccountPermissions } from '@shared/types';
import { validateTeamName } from '@shared/utils';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as teamsService from '@services/teams.service';

const router = Router();

// POST /api/teams - Create a new team
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, logo, venueId } = req.body;

  const nameValid = validateTeamName(name);
  if (nameValid !== true) {
    return res.status(400).json({ errors: nameValid });
  }

  try {
    const result = await teamsService.createTeam({
      name,
      logo,
      venueId,
      leaderId: req.account!.userId,
    });

    if (result.error) {
      return res.status(400).json({ errors: [result.error] });
    }

    res.status(201).json({
      ...result.team,
      isLeader: result.isLeader,
    });
  } catch (error) {
    apiLogger.error('Error creating team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/teams/current - Get current user's team
router.get('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerData = await teamsService.getPlayerWithTeam(req.account!.playerId!);

    if (!playerData?.team) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    res.json({
      ...playerData.team,
      isLeader: !!playerData.ledTeam,
    });
  } catch (error) {
    apiLogger.error('Error fetching team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/teams/current - Get current user's team
router.put('/current', authMiddleware, requirePermission('team', 'canManageTeam'), async (req: AuthRequest, res: Response) => {
  try {
    const team = await teamsService.getPlayerTeam(req.account!.playerId!);

    if (!team) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    const { name, logo, venueId } = req.body;

    if (name !== undefined) {
      const nameValid = validateTeamName(name);
      if (nameValid !== true) {
        return res.status(400).json({ errors: nameValid });
      }
    }

    const result = await teamsService.updateTeam(team.id, { name, logo, venueId });

    if (result.error) {
      return res.status(400).json({ errors: [result.error] });
    }

    res.json(result.team);
  } catch (error) {
    apiLogger.error('Error updating team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/teams/current/members - Get team members with permissions
router.get('/current/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await teamsService.getPlayerTeam(req.account!.playerId!);

    if (!team) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    const members = await teamsService.getTeamMembers(team.id);
    res.json(members);
  } catch (error) {
    apiLogger.error('Error fetching members:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// PUT /api/teams/current/members/:memberId/permissions - Update member permissions
router.put(
  '/current/members/:memberId/permissions',
  authMiddleware,
  requirePermission('team', 'canManagePermissions'),
  async (req: AuthRequest, res: Response) => {
    const { memberId } = req.params;
    const { permissions } = req.body as { permissions: AccountPermissions };

    try {
      const result = await teamsService.updateMemberPermissions(
        req.account!.userId,
        memberId,
        permissions
      );

      if (!result.success) {
        const status = result.error?.includes('trouvé') ? 404 : 403;
        return res.status(status).json({ errors: [result.error] });
      }

      res.json({ message: 'Permissions mises à jour' });
    } catch (error) {
      apiLogger.error('Error updating permissions:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
    }
  }
);

// DELETE /api/teams/current/members/:memberId - Remove member from team
router.delete(
  '/current/members/:memberId',
  authMiddleware,
  requirePermission('team', 'canRemoveMembers'),
  async (req: AuthRequest, res: Response) => {
    const { memberId } = req.params;

    try {
      const result = await teamsService.removeMember(req.account!.userId, memberId);

      if (!result.success) {
        const status = result.error?.includes('trouvé') ? 404 : 403;
        return res.status(status).json({ errors: [result.error] });
      }

      res.json({ message: 'Membre retiré de l\'équipe' });
    } catch (error) {
      apiLogger.error('Error removing member:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
    }
  }
);

// DELETE /api/teams/current - Delete the team (leader only)
router.delete('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await teamsService.deleteTeam(req.account!.playerId!);

    if (!result.success) {
      const status = result.error?.includes('leader') ? 403 : 404;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({ message: 'Équipe supprimée avec succès' });
  } catch (error) {
    apiLogger.error('Error deleting team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/teams/current/leave - Leave the team (for non-leader members)
router.post('/current/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await teamsService.leaveTeam(req.account!.playerId!);

    if (!result.success) {
      const status = result.error?.includes('leader') ? 403 : 404;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({ message: 'Vous avez quitté l\'équipe' });
  } catch (error) {
    apiLogger.error('Error leaving team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;
