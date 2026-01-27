// Team invitations routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import * as invitesService from '@services/invites.service';

const router = Router();

// POST /api/teams/:teamId/invites - Create an invitation link
router.post(
  '/teams/:teamId/invites',
  authMiddleware,
  requirePermission('team', 'canInviteMembers'),
  async (req: AuthRequest, res: Response) => {
    const { teamId } = req.params;
    const { expiresInHours = 24, maxUses = 1 } = req.body;

    // Validate inputs
    if (typeof expiresInHours !== 'number' || expiresInHours < 1 || expiresInHours > 168) {
      return res.status(400).json({ errors: ['La durée d\'expiration doit être entre 1 et 168 heures'] });
    }

    if (typeof maxUses !== 'number' || maxUses < 1 || maxUses > 50) {
      return res.status(400).json({ errors: ['Le nombre d\'utilisations doit être entre 1 et 50'] });
    }

    try {
      // Verify user belongs to this team
      const user = await invitesService.verifyUserBelongsToTeam(req.user!.userId, teamId);
      if (!user) {
        return res.status(403).json({ errors: ['Vous ne pouvez créer des invitations que pour votre équipe'] });
      }

      const invite = await invitesService.createInvite({
        teamId,
        createdById: req.user!.userId,
        expiresInHours,
        maxUses,
      });

      res.status(201).json(invite);
    } catch (error) {
      console.error('Error creating invite:', error);
      res.status(500).json({ errors: ['Erreur serveur'] });
    }
  }
);

// GET /api/teams/:teamId/invites - List active invitations
router.get(
  '/teams/:teamId/invites',
  authMiddleware,
  requirePermission('team', 'canInviteMembers'),
  async (req: AuthRequest, res: Response) => {
    const { teamId } = req.params;

    try {
      // Verify user belongs to this team
      const user = await invitesService.verifyUserBelongsToTeam(req.user!.userId, teamId);
      if (!user) {
        return res.status(403).json({ errors: ['Accès non autorisé'] });
      }

      const invites = await invitesService.getActiveInvites(teamId);
      res.json(invites);
    } catch (error) {
      console.error('Error listing invites:', error);
      res.status(500).json({ errors: ['Erreur serveur'] });
    }
  }
);

// DELETE /api/teams/:teamId/invites/:inviteId - Revoke an invitation
router.delete(
  '/teams/:teamId/invites/:inviteId',
  authMiddleware,
  requirePermission('team', 'canInviteMembers'),
  async (req: AuthRequest, res: Response) => {
    const { teamId, inviteId } = req.params;

    try {
      // Verify user belongs to this team
      const user = await invitesService.verifyUserBelongsToTeam(req.user!.userId, teamId);
      if (!user) {
        return res.status(403).json({ errors: ['Accès non autorisé'] });
      }

      const result = await invitesService.deleteInvite(inviteId, teamId);

      if (!result.success) {
        return res.status(404).json({ errors: [result.error] });
      }

      res.json({ message: 'Invitation révoquée' });
    } catch (error) {
      console.error('Error deleting invite:', error);
      res.status(500).json({ errors: ['Erreur serveur'] });
    }
  }
);

// GET /api/invites/:code - Verify invite code validity (public)
router.get('/invites/:code', async (req, res: Response) => {
  const { code } = req.params;

  try {
    const result = await invitesService.verifyInviteCode(code);
    res.json(result);
  } catch (error) {
    console.error('Error verifying invite:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// POST /api/invites/:code/join - Join team using invite code
router.post('/invites/:code/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { code } = req.params;

  try {
    const result = await invitesService.joinTeamWithCode(req.user!.userId, code);

    if (!result.success) {
      const status = result.error?.includes('invalide') ? 404 : 400;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({
      message: `Vous avez rejoint l'équipe ${result.teamName}`,
      teamId: result.teamId,
      teamName: result.teamName,
    });
  } catch (error) {
    console.error('Error joining team:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

export default router;
