// Team invitations routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as invitesService from '@services/invites.service';

const router = Router();

/**
 * Resolve the public origin of the current request (e.g. https://eva.up.railway.app).
 * Requires `app.set('trust proxy', true)` so the forwarded protocol is honored.
 */
function getOrigin(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}

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
      return res.status(400).json({ errors: [ERROR.inviteExpirationInvalid] });
    }

    if (typeof maxUses !== 'number' || maxUses < 1 || maxUses > 50) {
      return res.status(400).json({ errors: [ERROR.inviteMaxUsesInvalid] });
    }

    try {
      // Verify player belongs to this team
      const player = await invitesService.verifyPlayerBelongsToTeam(req.account!.playerId!, teamId);
      if (!player) {
        return res.status(403).json({ errors: [ERROR.forbidden] });
      }

      const invite = await invitesService.createInvite({
        teamId,
        createdByPlayerId: req.account!.playerId!,
        baseUrl: getOrigin(req),
        expiresInHours,
        maxUses,
      });

      res.status(201).json(invite);
    } catch (error) {
      apiLogger.error('Error creating invite:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
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
      // Verify player belongs to this team
      const player = await invitesService.verifyPlayerBelongsToTeam(req.account!.playerId!, teamId);
      if (!player) {
        return res.status(403).json({ errors: [ERROR.forbidden] });
      }

      const invites = await invitesService.getActiveInvites(teamId, getOrigin(req));
      res.json(invites);
    } catch (error) {
      apiLogger.error('Error listing invites:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
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
      // Verify player belongs to this team
      const player = await invitesService.verifyPlayerBelongsToTeam(req.account!.playerId!, teamId);
      if (!player) {
        return res.status(403).json({ errors: [ERROR.forbidden] });
      }

      const result = await invitesService.deleteInvite(inviteId, teamId);

      if (!result.success) {
        return res.status(404).json({ errors: [result.error] });
      }

      res.json({ message: 'Invitation révoquée' });
    } catch (error) {
      apiLogger.error('Error deleting invite:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
    }
  }
);

// GET /api/invites/:code - Verify invite code validity
router.get('/invites/:code', authMiddleware, async (req, res: Response) => {
  const { code } = req.params;

  try {
    const result = await invitesService.verifyInviteCode(code);
    res.json(result);
  } catch (error) {
    apiLogger.error('Error verifying invite:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/invites/:code/join - Join team using invite code
router.post('/invites/:code/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { code } = req.params;

  try {
    const result = await invitesService.joinTeamWithCode(req.account!.playerId!, code);

    if (!result.success) {
      const status = result.error === ERROR.inviteInvalid ? 404 : 400;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({
      message: `Vous avez rejoint l'équipe ${result.teamName}`,
      teamId: result.teamId,
      teamName: result.teamName,
    });
  } catch (error) {
    apiLogger.error('Error joining team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;
