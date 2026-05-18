// Manager service - Manager-specific business logic

import { randomUUID } from 'crypto';
import { prisma } from '@db/prisma';
import { DEFAULT_MANAGER_PERMISSIONS } from '@shared/types';

// Activation token validity: 7 days
const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================
// Manager CRUD operations
// ============================================

/**
 * Create a new Manager (and associated User account)
 * Note: Manager accounts are created by admins, password set via activation flow
 */
export async function createManager(
  email: string,
  hashedPassword: string,
  name: string
) {
  // Create Manager first
  const manager = await prisma.manager.create({
    data: {
      permissions: DEFAULT_MANAGER_PERMISSIONS as unknown as object,
    },
  });

  // Create User account linked to Manager
  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      managerId: manager.id,
    },
    include: {
      manager: true,
    },
  });
}

/**
 * Get manager by ID with user data
 */
export async function getManagerById(managerId: string) {
  return prisma.manager.findUnique({
    where: { id: managerId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      managedVenues: {
        include: { venue: true },
      },
    },
  });
}

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

export interface ManagerSummary {
  id: string;
  userId: string;
  email: string;
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
  user: { id: string; email: string; name: string } | null;
  managedVenues: { venue: { id: string; name: string; city: string } }[];
}): ManagerSummary | null {
  if (!record.user) return null;
  return {
    id: record.id,
    userId: record.user.id,
    email: record.user.email,
    name: record.user.name,
    activationPending: !!record.activationToken,
    activationToken: record.activationToken,
    activationTokenExpiresAt: record.activationTokenExpiresAt,
    venues: record.managedVenues.map(vm => vm.venue),
  };
}

/**
 * List all managers with their venues (admin only).
 */
export async function listManagers(): Promise<ManagerSummary[]> {
  const managers = await prisma.manager.findMany({
    include: {
      user: { select: { id: true, email: true, name: true } },
      managedVenues: {
        include: { venue: { select: { id: true, name: true, city: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return managers
    .map(toManagerSummary)
    .filter((m): m is ManagerSummary => m !== null);
}

/**
 * Get a single manager summary by id.
 */
export async function getManagerSummary(managerId: string): Promise<ManagerSummary | null> {
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      managedVenues: {
        include: { venue: { select: { id: true, name: true, city: true } } },
      },
    },
  });
  return manager ? toManagerSummary(manager) : null;
}

/**
 * Create a manager account with an activation token. The password is set to
 * a random throwaway value; the manager will set their real password through
 * `/api/auth/activate`.
 *
 * Returns the new manager along with the activation token so the admin can
 * forward the link.
 */
export async function createManagerWithActivation(
  email: string,
  name: string,
  venueIds: string[],
): Promise<{ manager: ManagerSummary; activationToken: string } | { error: 'emailExists' | 'invalidVenues' }> {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();

  // Email uniqueness
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return { error: 'emailExists' };

  // Validate venues
  if (venueIds.length > 0) {
    const found = await prisma.venue.count({ where: { id: { in: venueIds } } });
    if (found !== venueIds.length) return { error: 'invalidVenues' };
  }

  const activationToken = randomUUID();
  const activationTokenExpiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    const manager = await tx.manager.create({
      data: {
        permissions: DEFAULT_MANAGER_PERMISSIONS as unknown as object,
        activationToken,
        activationTokenExpiresAt,
      },
    });

    await tx.user.create({
      data: {
        email: normalizedEmail,
        // Random unguessable placeholder; will be replaced on activation.
        password: randomUUID(),
        name: trimmedName,
        managerId: manager.id,
      },
    });

    if (venueIds.length > 0) {
      await tx.venueManager.createMany({
        data: venueIds.map(venueId => ({ managerId: manager.id, venueId })),
      });
    }

    return manager;
  });

  // Re-fetch with full includes to build the summary
  const summary = await prisma.manager.findFirst({
    where: { activationToken },
    include: {
      user: { select: { id: true, email: true, name: true } },
      managedVenues: {
        include: { venue: { select: { id: true, name: true, city: true } } },
      },
    },
  });

  if (!summary || !summary.user) {
    throw new Error('Failed to load created manager');
  }

  return {
    manager: toManagerSummary(summary)!,
    activationToken,
  };
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
 * Delete a manager and its linked User account.
 */
export async function deleteManager(managerId: string): Promise<boolean> {
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
    include: { user: { select: { id: true } } },
  });
  if (!manager) return false;

  // VenueManager cascades via schema (onDelete: Cascade on managerId).
  // We must delete the linked User explicitly because User.managerId is
  // SetNull on Manager delete.
  await prisma.$transaction([
    ...(manager.user ? [prisma.user.delete({ where: { id: manager.user.id } })] : []),
    prisma.manager.delete({ where: { id: managerId } }),
  ]);

  return true;
}
