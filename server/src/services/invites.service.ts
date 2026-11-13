// Team invitations service - business logic

import { prisma } from '@db/prisma';
import crypto from 'crypto';
import { ERROR } from '@shared/constants';
import { logoUrlOf } from '@services/teams.service';

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
 * Build the full invite URL using the public origin of the current request
 * (e.g. https://eva.up.railway.app). The caller is expected to derive this
 * from the Express request — see `invites.routes.ts`.
 */
export function buildInviteUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, '')}/join/${code}`;
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

// Who made a link, read with it
const WITH_CREATOR = { createdBy: { select: { user: { select: { name: true } } } } } as const;

type InviteRow = {
  id: string;
  code: string;
  expiresAt: Date;
  maxUses: number;
  uses: number;
  createdAt: Date;
  createdBy: { user: { name: string } | null };
};

/**
 * A link as the team page shows it, the same whether it was just made or is
 * listed: who made it tells two links apart, its code saying nothing to a
 * reader
 */
function toInviteView(invite: InviteRow, baseUrl: string) {
  return {
    id: invite.id,
    code: invite.code,
    url: buildInviteUrl(baseUrl, invite.code),
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    uses: invite.uses,
    createdBy: invite.createdBy.user?.name ?? '',
    createdAt: invite.createdAt,
  };
}

// ============================================
// Invite operations
// ============================================

export interface CreateInviteData {
  teamId: string;
  createdByPlayerId: string;
  baseUrl: string;
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
    include: WITH_CREATOR,
  });

  return toInviteView(invite, data.baseUrl);
}

/**
 * Get active invitations for a team
 */
export async function getActiveInvites(teamId: string, baseUrl: string) {
  const invites = await prisma.teamInvite.findMany({
    where: {
      teamId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: WITH_CREATOR,
  });

  // Filter out fully used invites
  const activeInvites = invites.filter(invite => invite.uses < invite.maxUses);

  return activeInvites.map(invite => toInviteView(invite, baseUrl));
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
      team: { select: { id: true, name: true, logoType: true, logoUpdatedAt: true } },
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
    teamLogoUrl: logoUrlOf(invite.team),
    expiresAt: invite.expiresAt,
  };
}

/**
 * Join a team using an invite code
 */
// The player was given a team by another way while joining with the link
class JoinedMeanwhile extends Error {}

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

  let reserved: boolean;
  try {
    reserved = await prisma.$transaction(async tx => {
      // A use is taken first, while one is left: of two players opening the
      // link at once, only one gets its last use
      const { count: taken } = await tx.teamInvite.updateMany({
        where: { id: invite.id, uses: { lt: prisma.teamInvite.fields.maxUses }, expiresAt: { gt: new Date() } },
        data: { uses: { increment: 1 } },
      });
      if (taken === 0) return false;
      // The player joins, unless another way gave them a team meanwhile: then the use is given back
      const { count: joined } = await tx.player.updateMany({
        where: { id: playerId, teamId: null },
        data: { teamId: invite.teamId },
      });
      if (joined === 0) throw new JoinedMeanwhile();
      // A request to join a team, waiting, is answered by joining one
      await tx.teamJoinRequest.deleteMany({ where: { playerId, status: 'PENDING' } });
      return true;
    });
  } catch (error) {
    if (error instanceof JoinedMeanwhile) return { success: false, error: ERROR.userAlreadyInTeam };
    throw error;
  }
  if (!reserved) {
    return { success: false, error: ERROR.inviteMaxUsesReached };
  }

  return {
    success: true,
    teamId: invite.teamId,
    teamName: invite.team.name,
  };
}
