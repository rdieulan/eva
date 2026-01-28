// Team routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { UserPermissions } from '@shared/types';
import { TEAM_LOCATIONS } from '@shared/types';
import { validateTeamName } from '@shared/utils';
import { ERROR_MESSAGES } from '@shared/constants';
import * as teamsService from '@services/teams.service';

const router = Router();

// POST /api/teams - Create a new team
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, logo, location } = req.body;

  const nameValid = validateTeamName(name);
  if (nameValid !== true) {
    return res.status(400).json({ errors: nameValid });
  }

  try {
    const result = await teamsService.createTeam({
      name,
      logo,
      location,
      leaderId: req.user!.userId,
    });

    if ('error' in result) {
      return res.status(400).json({ errors: [result.error] });
    }

    res.status(201).json({
      ...result.team,
      isLeader: result.isLeader,
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
  }
});

// GET /api/teams/current - Get current user's team
router.get('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await teamsService.getUserWithTeam(req.user!.userId);

    if (!user?.team) {
      return res.status(404).json({ errors: [ERROR_MESSAGES.teamNotFound] });
    }

    res.json({
      ...user.team,
      isLeader: !!user.ledTeam,
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
  }
});

// GET /api/teams/locations - Get available locations
router.get('/locations', (_req, res: Response) => {
  res.json(TEAM_LOCATIONS);
});

// PUT /api/teams/current - Update team info
router.put('/current', authMiddleware, requirePermission('team', 'canManageTeam'), async (req: AuthRequest, res: Response) => {
  try {
    const team = await teamsService.getUserTeam(req.user!.userId);

    if (!team) {
      return res.status(404).json({ errors: [ERROR_MESSAGES.teamNotFound] });
    }

    const { name, logo, location } = req.body;

    if (name !== undefined) {
      const nameValid = validateTeamName(name);
      if (nameValid !== true) {
        return res.status(400).json({ errors: nameValid });
      }
    }

    const updatedTeam = await teamsService.updateTeam(team.id, { name, logo, location });
    res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
  }
});

// GET /api/teams/current/members - Get team members with permissions
router.get('/current/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await teamsService.getUserTeam(req.user!.userId);

    if (!team) {
      return res.status(404).json({ errors: [ERROR_MESSAGES.teamNotFound] });
    }

    const members = await teamsService.getTeamMembers(team.id);
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
  }
});

// PUT /api/teams/current/members/:memberId/permissions - Update member permissions
router.put(
  '/current/members/:memberId/permissions',
  authMiddleware,
  requirePermission('team', 'canManagePermissions'),
  async (req: AuthRequest, res: Response) => {
    const { memberId } = req.params;
    const { permissions } = req.body as { permissions: UserPermissions };

    try {
      const result = await teamsService.updateMemberPermissions(
        req.user!.userId,
        memberId,
        permissions
      );

      if (!result.success) {
        const status = result.error?.includes('trouvé') ? 404 : 403;
        return res.status(status).json({ errors: [result.error] });
      }

      res.json({ message: 'Permissions mises à jour' });
    } catch (error) {
      console.error('Error updating permissions:', error);
      res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
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
      const result = await teamsService.removeMember(req.user!.userId, memberId);

      if (!result.success) {
        const status = result.error?.includes('trouvé') ? 404 : 403;
        return res.status(status).json({ errors: [result.error] });
      }

      res.json({ message: 'Membre retiré de l\'équipe' });
    } catch (error) {
      console.error('Error removing member:', error);
      res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
    }
  }
);

// DELETE /api/teams/current - Delete the team (leader only)
router.delete('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await teamsService.deleteTeam(req.user!.userId);

    if (!result.success) {
      const status = result.error?.includes('leader') ? 403 : 404;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({ message: 'Équipe supprimée avec succès' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
  }
});

// POST /api/teams/current/leave - Leave the team (for non-leader members)
router.post('/current/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await teamsService.leaveTeam(req.user!.userId);

    if (!result.success) {
      const status = result.error?.includes('leader') ? 403 : 404;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({ message: 'Vous avez quitté l\'équipe' });
  } catch (error) {
    console.error('Error leaving team:', error);
    res.status(500).json({ errors: [ERROR_MESSAGES.serverError] });
  }
});

export default router;
