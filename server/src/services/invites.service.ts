// Team invitations service - business logic

import { prisma } from '@db/prisma';
import crypto from 'crypto';

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
    return 'Ce lien d\'invitation a expiré';
  }
  if (invite.uses >= invite.maxUses) {
    return 'Ce lien d\'invitation a atteint sa limite d\'utilisation';
  }
  return null;
}

/**
 * Verify user belongs to the specified team
 */
export async function verifyUserBelongsToTeam(userId: string, teamId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  return user?.teamId === teamId ? user : null;
}

// ============================================
// Invite operations
// ============================================

export interface CreateInviteData {
  teamId: string;
  createdById: string;
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
      createdById: data.createdById,
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
      createdBy: { select: { name: true } },
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
    createdBy: invite.createdBy.name,
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
    return { valid: false, reason: 'Lien d\'invitation invalide' };
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
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string; teamId?: string; teamName?: string }> {
  // Check if user already has a team
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (user?.teamId) {
    return { success: false, error: 'Vous êtes déjà membre d\'une équipe' };
  }

  // Find and validate invite
  const invite = await prisma.teamInvite.findUnique({
    where: { code },
    include: {
      team: { select: { id: true, name: true } },
    },
  });

  if (!invite) {
    return { success: false, error: 'Lien d\'invitation invalide' };
  }

  const inviteError = getInviteError(invite);
  if (inviteError) {
    return { success: false, error: inviteError };
  }

  // Use transaction to ensure atomicity
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
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
