// Manager service - Manager-specific business logic

import { prisma } from '@db/prisma';
import { DEFAULT_MANAGER_PERMISSIONS } from '@shared/types';
import { newInvitation } from '@services/invitation.service';

// ============================================
// Manager CRUD operations
// ============================================

/**
 * Get manager by user ID
 */
export async function getManagerByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      manager: {
        include: {
          managedVenues: {
            include: { venue: true },
          },
        },
      },
    },
  });
  return user?.manager ?? null;
}


/**
 * Update manager permissions
 */
export async function updateManagerPermissions(managerId: string, permissions: object) {
  return prisma.manager.update({
    where: { id: managerId },
    data: { permissions },
  });
}

/**
 * Reset manager permissions to default
 */
export async function resetManagerPermissions(managerId: string) {
  return prisma.manager.update({
    where: { id: managerId },
    data: { permissions: DEFAULT_MANAGER_PERMISSIONS as unknown as object },
  });
}

/**
 * Get venues managed by this manager
 */
export async function getManagedVenues(managerId: string) {
  const venueManagers = await prisma.venueManager.findMany({
    where: { managerId },
    include: { venue: true },
  });
  return venueManagers.map(vm => vm.venue);
}

/**
 * Check if manager manages a specific venue
 */
export async function managerManagesVenue(managerId: string, venueId: string): Promise<boolean> {
  const count = await prisma.venueManager.count({
    where: { managerId, venueId },
  });
  return count > 0;
}

// ============================================
// Admin operations
// ============================================

// A manager, or an invitation to manage not yet accepted (no account yet: it
// shows the name the admin gave it, and the link to send)
export interface ManagerSummary {
  id: string;
  userId: string | null;
  name: string;
  activationPending: boolean;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;
  venues: { id: string; name: string; city: string }[];
}

function toManagerSummary(record: {
  id: string;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;
  invitedName: string | null;
  user: { id: string; name: string } | null;
  managedVenues: { venue: { id: string; name: string; city: string } }[];
}): ManagerSummary {
  const isPending = !record.user;
  return {
    id: record.id,
    userId: record.user?.id ?? null,
    name: record.user?.name ?? record.invitedName ?? '',
    activationPending: isPending,
    activationToken: isPending ? record.activationToken : null,
    activationTokenExpiresAt: isPending ? record.activationTokenExpiresAt : null,
    venues: record.managedVenues.map(vm => vm.venue),
  };
}

/**
 * List all managers with their venues (admin only).
 */
export async function listManagers(): Promise<ManagerSummary[]> {
  const managers = await prisma.manager.findMany({
    include: {
      user: { select: { id: true, name: true } },
      managedVenues: {
        include: { venue: { select: { id: true, name: true, city: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return managers.map(toManagerSummary);
}

/**
 * Get a single manager summary by id.
 */
export async function getManagerSummary(managerId: string): Promise<ManagerSummary | null> {
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
    include: {
      user: { select: { id: true, name: true } },
      managedVenues: {
        include: { venue: { select: { id: true, name: true, city: true } } },
      },
    },
  });
  return manager ? toManagerSummary(manager) : null;
}

/**
 * Invite someone to manage venues: the manager exists without an account until
 * someone opens its link and signs in with Discord (see invitation.service).
 * Returns the invitation with its token, for the admin to send the link.
 */
export async function createManagerWithActivation(
  invitedName: string,
  venueIds: string[],
): Promise<{ manager: ManagerSummary; activationToken: string } | { error: 'invalidVenues' }> {
  if (venueIds.length > 0) {
    const found = await prisma.venue.count({ where: { id: { in: venueIds } } });
    if (found !== venueIds.length) return { error: 'invalidVenues' };
  }

  const invitation = newInvitation();
  const manager = await prisma.manager.create({
    data: {
      permissions: DEFAULT_MANAGER_PERMISSIONS as unknown as object,
      ...invitation,
      invitedName,
      managedVenues: { create: venueIds.map(venueId => ({ venueId })) },
    },
    select: { id: true },
  });

  return { manager: (await getManagerSummary(manager.id))!, activationToken: invitation.activationToken };
}

/**
 * Replace the set of venues a manager manages.
 */
export async function updateManagerVenues(
  managerId: string,
  venueIds: string[],
): Promise<ManagerSummary | null | { error: 'invalidVenues' }> {
  const manager = await prisma.manager.findUnique({ where: { id: managerId }, select: { id: true } });
  if (!manager) return null;

  if (venueIds.length > 0) {
    const found = await prisma.venue.count({ where: { id: { in: venueIds } } });
    if (found !== venueIds.length) return { error: 'invalidVenues' };
  }

  await prisma.$transaction([
    prisma.venueManager.deleteMany({ where: { managerId } }),
    ...(venueIds.length > 0
      ? [
          prisma.venueManager.createMany({
            data: venueIds.map(venueId => ({ managerId, venueId })),
          }),
        ]
      : []),
  ]);

  return getManagerSummary(managerId);
}

/**
 * Take the manager role away, or drop an invitation not yet accepted. The
 * person keeps their account: they stay a player. Their venues go with the
 * role (VenueManager cascades), and the account forgets it (SetNull).
 */
export async function deleteManager(managerId: string): Promise<boolean> {
  const { count } = await prisma.manager.deleteMany({ where: { id: managerId } });
  return count > 0;
}
