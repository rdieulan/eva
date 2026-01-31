// Manager service - Manager-specific business logic

import { prisma } from '@db/prisma';
import { DEFAULT_MANAGER_PERMISSIONS } from '@shared/types';

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
