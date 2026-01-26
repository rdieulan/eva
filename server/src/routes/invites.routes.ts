// Team invitations routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import crypto from 'crypto';

const router = Router();

/**
 * Generate a random invite code
 */
function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Build the full invite URL
 */
function buildInviteUrl(code: string): string {
  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  return `${baseUrl}/join/${code}`;
}

/**
 * Check if an invite is valid (not expired, not fully used)
 * Returns null if valid, or error reason string if invalid
 */
function getInviteError(invite: { expiresAt: Date; uses: number; maxUses: number }): string | null {
  if (new Date() > invite.expiresAt) {
    return 'Ce lien d\'invitation a expiré';
  }
  if (invite.uses >= invite.maxUses) {
    return 'Ce lien d\'invitation a atteint sa limite d\'utilisation';
  }
  return null;
}

/**
 * Verify user belongs to the specified team
 * Returns the user if valid, null otherwise
 */
async function verifyUserBelongsToTeam(userId: string, teamId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  return user?.teamId === teamId ? user : null;
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
      return res.status(400).json({ errors: ['La durée d\'expiration doit être entre 1 et 168 heures'] });
    }

    if (typeof maxUses !== 'number' || maxUses < 1 || maxUses > 50) {
      return res.status(400).json({ errors: ['Le nombre d\'utilisations doit être entre 1 et 50'] });
    }

    try {
      // Verify user belongs to this team
      const user = await verifyUserBelongsToTeam(req.user!.userId, teamId);
      if (!user) {
        return res.status(403).json({ errors: ['Vous ne pouvez créer des invitations que pour votre équipe'] });
      }

      // Generate unique code
      const code = generateInviteCode();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      // Create invitation
      const invite = await prisma.teamInvite.create({
        data: {
          teamId,
          code,
          createdById: req.user!.userId,
          expiresAt,
          maxUses,
        },
      });

      res.status(201).json({
        id: invite.id,
        code: invite.code,
        url: buildInviteUrl(invite.code),
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        uses: invite.uses,
      });
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
      const user = await verifyUserBelongsToTeam(req.user!.userId, teamId);
      if (!user) {
        return res.status(403).json({ errors: ['Accès non autorisé'] });
      }

      // Get active invitations (not expired and not fully used)
      const invites = await prisma.teamInvite.findMany({
        where: {
          teamId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { name: true } },
        },
      });

      // Filter out fully used invites
      const activeInvites = invites.filter((invite) => invite.uses < invite.maxUses);

      res.json(
        activeInvites.map((invite) => ({
          id: invite.id,
          code: invite.code,
          url: buildInviteUrl(invite.code),
          expiresAt: invite.expiresAt,
          maxUses: invite.maxUses,
          uses: invite.uses,
          createdBy: invite.createdBy.name,
          createdAt: invite.createdAt,
        }))
      );
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
      const user = await verifyUserBelongsToTeam(req.user!.userId, teamId);
      if (!user) {
        return res.status(403).json({ errors: ['Accès non autorisé'] });
      }

      // Verify invite belongs to this team
      const invite = await prisma.teamInvite.findUnique({
        where: { id: inviteId },
      });

      if (!invite || invite.teamId !== teamId) {
        return res.status(404).json({ errors: ['Invitation non trouvée'] });
      }

      // Delete the invite
      await prisma.teamInvite.delete({
        where: { id: inviteId },
      });

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
    const invite = await prisma.teamInvite.findUnique({
      where: { code },
      include: {
        team: { select: { name: true, logo: true } },
      },
    });

    if (!invite) {
      return res.json({ valid: false, reason: 'Lien d\'invitation invalide' });
    }

    const inviteError = getInviteError(invite);
    if (inviteError) {
      return res.json({ valid: false, reason: inviteError });
    }

    res.json({
      valid: true,
      teamName: invite.team.name,
      teamLogo: invite.team.logo,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error('Error verifying invite:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// POST /api/invites/:code/join - Join team using invite code
router.post('/invites/:code/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { code } = req.params;

  try {
    // Check if user already has a team
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (user?.teamId) {
      return res.status(400).json({ errors: ['Vous êtes déjà membre d\'une équipe'] });
    }

    // Find and validate invite
    const invite = await prisma.teamInvite.findUnique({
      where: { code },
      include: {
        team: { select: { id: true, name: true } },
      },
    });

    if (!invite) {
      return res.status(404).json({ errors: ['Lien d\'invitation invalide'] });
    }

    const inviteError = getInviteError(invite);
    if (inviteError) {
      return res.status(400).json({ errors: [inviteError] });
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction([
      // Add user to team
      prisma.user.update({
        where: { id: req.user!.userId },
        data: { teamId: invite.teamId },
      }),
      // Increment invite uses
      prisma.teamInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    res.json({
      message: `Vous avez rejoint l'équipe ${invite.team.name}`,
      teamId: invite.teamId,
      teamName: invite.team.name,
    });
  } catch (error) {
    console.error('Error joining team:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

export default router;
