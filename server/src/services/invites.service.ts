// Team invitations service - business logic

import { prisma } from '@db/prisma';
import crypto from 'crypto';
import { ERROR } from '@shared/constants';

// ============================================
// Constants
// ============================================
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// ============================================
// Helpers
// ============================================

/**
 * Generate a random invite code
 */
export function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Build the full invite URL
 */
export function buildInviteUrl(code: string): string {
  return `${APP_URL}/join/${code}`;
}

/**
 * Check if an invite is valid
 * Returns null if valid, or error reason string if invalid
 */
export function getInviteError(invite: { expiresAt: Date; uses: number; maxUses: number }): string | null {
  if (new Date() > invite.expiresAt) {
    return ERROR.inviteExpired;
  }
  if (invite.uses >= invite.maxUses) {
    return ERROR.inviteMaxUsesReached;
  }
  return null;
}

// Re-export from player.service for convenience
export { verifyPlayerBelongsToTeam } from '@services/player.service';

// ============================================
// Invite operations
// ============================================

export interface CreateInviteData {
  teamId: string;
  createdByPlayerId: string;
  expiresInHours?: number;
  maxUses?: number;
}

/**
 * Create a new team invitation
 */
export async function createInvite(data: CreateInviteData) {
  const expiresInHours = data.expiresInHours ?? 24;
  const maxUses = data.maxUses ?? 1;

  // Generate unique code
  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  const invite = await prisma.teamInvite.create({
    data: {
      teamId: data.teamId,
      code,
      createdById: data.createdByPlayerId,
      expiresAt,
      maxUses,
    },
  });

  return {
    id: invite.id,
    code: invite.code,
    url: buildInviteUrl(invite.code),
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    uses: invite.uses,
  };
}

/**
 * Get active invitations for a team
 */
export async function getActiveInvites(teamId: string) {
  const invites = await prisma.teamInvite.findMany({
    where: {
      teamId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        include: { user: { select: { name: true } } }
      },
    },
  });

  // Filter out fully used invites
  const activeInvites = invites.filter(invite => invite.uses < invite.maxUses);

  return activeInvites.map(invite => ({
    id: invite.id,
    code: invite.code,
    url: buildInviteUrl(invite.code),
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    uses: invite.uses,
    createdBy: invite.createdBy.user!.name,
    createdAt: invite.createdAt,
  }));
}

/**
 * Delete an invitation
 */
export async function deleteInvite(
  inviteId: string,
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.teamId !== teamId) {
    return { success: false, error: 'Invitation non trouvée' };
  }

  await prisma.teamInvite.delete({
    where: { id: inviteId },
  });

  return { success: true };
}

/**
 * Verify an invite code (public)
 */
export async function verifyInviteCode(code: string) {
  const invite = await prisma.teamInvite.findUnique({
    where: { code },
    include: {
      team: { select: { name: true, logo: true } },
    },
  });

  if (!invite) {
    return { valid: false, reason: ERROR.inviteInvalid };
  }

  const inviteError = getInviteError(invite);
  if (inviteError) {
    return { valid: false, reason: inviteError };
  }

  return {
    valid: true,
    teamName: invite.team.name,
    teamLogo: invite.team.logo,
    expiresAt: invite.expiresAt,
  };
}

/**
 * Join a team using an invite code
 */
export async function joinTeamWithCode(
  playerId: string,
  code: string
): Promise<{ success: boolean; error?: string; teamId?: string; teamName?: string }> {
  // Check if player already has a team
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, teamId: true },
  });

  if (!player) {
    return { success: false, error: ERROR.userNotFound };
  }

  if (player.teamId) {
    return { success: false, error: ERROR.userAlreadyInTeam };
  }

  // Find and validate invite
  const invite = await prisma.teamInvite.findUnique({
    where: { code },
    include: {
      team: { select: { id: true, name: true } },
    },
  });

  if (!invite) {
    return { success: false, error: ERROR.inviteInvalid };
  }

  const inviteError = getInviteError(invite);
  if (inviteError) {
    return { success: false, error: inviteError };
  }

  // Use transaction to ensure atomicity
  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { teamId: invite.teamId },
    }),
    prisma.teamInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    }),
  ]);

  return {
    success: true,
    teamId: invite.teamId,
    teamName: invite.team.name,
  };
}
