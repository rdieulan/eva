// Invitations to a role: managing a venue, or administering the app. An admin
// creates the role without an account and sends its link; whoever opens it and
// signs in with Discord takes the role on their own account, made on the way
// if they had none. One use: the link stops working once accepted.

import { randomUUID } from 'crypto';
import type { AccountRole } from '@prisma/client';
import { prisma } from '@db/prisma';
import type { InvitationSummary } from '@shared/types';
import { INVITATION_TTL_DAYS } from '@shared/constants';

const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

/** A new invitation's token and the end of its validity */
export function newInvitation(): { activationToken: string; activationTokenExpiresAt: Date } {
  return { activationToken: randomUUID(), activationTokenExpiresAt: new Date(Date.now() + INVITATION_TTL_MS) };
}

function hasExpired(expiresAt: Date | null): boolean {
  return !expiresAt || expiresAt.getTime() <= Date.now();
}

/** An invitation as its link shows it, before anyone accepts it; null when the link leads nowhere (unknown, or used) */
export async function readInvitation(token: string): Promise<InvitationSummary | null> {
  const manager = await prisma.manager.findUnique({
    where: { activationToken: token },
    select: {
      invitedName: true,
      activationTokenExpiresAt: true,
      user: { select: { id: true } },
      managedVenues: { select: { venue: { select: { name: true } } }, orderBy: { venue: { name: 'asc' } } },
    },
  });
  if (manager && !manager.user) {
    return {
      role: 'manager',
      invitedName: manager.invitedName,
      venueNames: manager.managedVenues.map(managed => managed.venue.name),
      isExpired: hasExpired(manager.activationTokenExpiresAt),
    };
  }

  const admin = await prisma.admin.findUnique({
    where: { activationToken: token },
    select: { invitedName: true, activationTokenExpiresAt: true, user: { select: { id: true } } },
  });
  if (admin && !admin.user) {
    return { role: 'admin', invitedName: admin.invitedName, venueNames: [], isExpired: hasExpired(admin.activationTokenExpiresAt) };
  }

  return null;
}

/** Why an invitation gave nothing: unknown or used, out of date, or a role the account already holds */
export type InvitationError = 'invalid' | 'expired' | 'roleTaken';

// The account took the same role meanwhile (another invitation accepted at the
// same moment): thrown to undo the claim of this one, which stays to be used
class RoleTakenMeanwhile extends Error {}

/**
 * Give a person's account the role an invitation carries. Two people opening
 * the same link at once: one takes it, the other is told it was used.
 */
export async function acceptInvitation(token: string, userId: string): Promise<AccountRole | InvitationError> {
  try {
    return await claimInvitation(token, userId);
  } catch (error) {
    if (error instanceof RoleTakenMeanwhile) return 'roleTaken';
    throw error;
  }
}

function claimInvitation(token: string, userId: string): Promise<AccountRole | InvitationError> {
  return prisma.$transaction(async tx => {
    const holder = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { managerId: true, adminId: true } });

    const manager = await tx.manager.findUnique({
      where: { activationToken: token },
      select: { id: true, activationTokenExpiresAt: true, user: { select: { id: true } } },
    });
    if (manager) {
      if (manager.user) return 'invalid';
      if (hasExpired(manager.activationTokenExpiresAt)) return 'expired';
      if (holder.managerId) return 'roleTaken';
      const claimed = await tx.manager.updateMany({
        where: { id: manager.id, activationToken: token },
        data: { activationToken: null, activationTokenExpiresAt: null, invitedName: null },
      });
      if (claimed.count === 0) return 'invalid';
      const attached = await tx.user.updateMany({ where: { id: userId, managerId: null }, data: { managerId: manager.id } });
      if (attached.count === 0) throw new RoleTakenMeanwhile();
      return 'MANAGER';
    }

    const admin = await tx.admin.findUnique({
      where: { activationToken: token },
      select: { id: true, activationTokenExpiresAt: true, user: { select: { id: true } } },
    });
    if (admin) {
      if (admin.user) return 'invalid';
      if (hasExpired(admin.activationTokenExpiresAt)) return 'expired';
      if (holder.adminId) return 'roleTaken';
      const claimed = await tx.admin.updateMany({
        where: { id: admin.id, activationToken: token },
        data: { activationToken: null, activationTokenExpiresAt: null, invitedName: null },
      });
      if (claimed.count === 0) return 'invalid';
      const attached = await tx.user.updateMany({ where: { id: userId, adminId: null }, data: { adminId: admin.id } });
      if (attached.count === 0) throw new RoleTakenMeanwhile();
      return 'ADMIN';
    }

    return 'invalid';
  });
}
