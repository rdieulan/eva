// Team routes

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { UserPermissions } from '@shared/types';
import { TEAM_LOCATIONS } from '@shared/types';

const router = Router();

// GET /api/teams/current - Get current user's team
router.get('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        team: {
          include: {
            leader: { select: { id: true, name: true, email: true } },
            members: { select: { id: true, name: true, email: true, permissions: true } },
          },
        },
        ledTeam: true,
      },
    });

    if (!user?.team) {
      return res.status(404).json({ error: 'Aucune équipe trouvée' });
    }

    res.json({
      ...user.team,
      isLeader: !!user.ledTeam,
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/teams/locations - Get available locations
router.get('/locations', (_req, res: Response) => {
  res.json(TEAM_LOCATIONS);
});

// PUT /api/teams/current - Update team info
router.put('/current', authMiddleware, requirePermission('team', 'canManageTeam'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { team: true },
    });

    if (!user?.team) {
      return res.status(404).json({ error: 'Aucune équipe trouvée' });
    }

    const { name, logo, location } = req.body;

    const updatedTeam = await prisma.team.update({
      where: { id: user.team.id },
      data: {
        ...(name && { name }),
        ...(logo !== undefined && { logo }),
        ...(location !== undefined && { location }),
      },
    });

    res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/teams/current/members - Get team members with permissions
router.get('/current/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { team: true },
    });

    if (!user?.team) {
      return res.status(404).json({ error: 'Aucune équipe trouvée' });
    }

    const members = await prisma.user.findMany({
      where: { teamId: user.team.id },
      select: {
        id: true,
        name: true,
        email: true,
        permissions: true,
        ledTeam: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });

    const membersWithRole = members.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      permissions: member.permissions,
      isLeader: !!member.ledTeam,
    }));

    res.json(membersWithRole);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Erreur serveur' });
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
      // Get current user's team
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { team: true },
      });

      if (!currentUser?.team) {
        return res.status(404).json({ error: 'Aucune équipe trouvée' });
      }

      // Verify target member is in the same team
      const targetMember = await prisma.user.findUnique({
        where: { id: memberId },
        include: { ledTeam: true },
      });

      if (!targetMember || targetMember.teamId !== currentUser.team.id) {
        return res.status(404).json({ error: 'Membre non trouvé dans cette équipe' });
      }

      // Cannot modify leader's permissions
      if (targetMember.ledTeam) {
        return res.status(403).json({ error: 'Impossible de modifier les permissions du leader' });
      }

      // Cannot modify own permissions (prevent privilege escalation)
      if (memberId === req.user!.userId) {
        return res.status(403).json({ error: 'Impossible de modifier vos propres permissions' });
      }

      // Update permissions
      await prisma.user.update({
        where: { id: memberId },
        data: { permissions: permissions as unknown as object },
      });

      res.json({ message: 'Permissions mises à jour' });
    } catch (error) {
      console.error('Error updating permissions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
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
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { team: true },
      });

      if (!currentUser?.team) {
        return res.status(404).json({ error: 'Aucune équipe trouvée' });
      }

      const targetMember = await prisma.user.findUnique({
        where: { id: memberId },
        include: { ledTeam: true },
      });

      if (!targetMember || targetMember.teamId !== currentUser.team.id) {
        return res.status(404).json({ error: 'Membre non trouvé dans cette équipe' });
      }

      // Cannot remove the leader
      if (targetMember.ledTeam) {
        return res.status(403).json({ error: 'Impossible de retirer le leader de l\'équipe' });
      }

      // Cannot remove yourself
      if (memberId === req.user!.userId) {
        return res.status(403).json({ error: 'Impossible de vous retirer vous-même' });
      }

      await prisma.user.update({
        where: { id: memberId },
        data: { teamId: null },
      });

      res.json({ message: 'Membre retiré de l\'équipe' });
    } catch (error) {
      console.error('Error removing member:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

export default router;
