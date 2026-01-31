// Admin service - Admin-specific business logic

import { prisma } from '@db/prisma';
import { DEFAULT_ADMIN_PERMISSIONS } from '@shared/types';

// ============================================
// Admin CRUD operations
// ============================================

/**
 * Create a new Admin (and associated User account)
 * Only super admin can create other admins
 */
export async function createAdmin(
  email: string,
  hashedPassword: string,
  name: string,
  permissions?: object
) {
  // Create Admin first
  const admin = await prisma.admin.create({
    data: {
      permissions: (permissions ?? DEFAULT_ADMIN_PERMISSIONS) as unknown as object,
    },
  });

  // Create User account linked to Admin
  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      adminId: admin.id,
    },
    include: {
      admin: true,
    },
  });
}

/**
 * Get admin by ID with user data
 */
export async function getAdminById(adminId: string) {
  return prisma.admin.findUnique({
    where: { id: adminId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

/**
 * Get admin by user ID
 */
export async function getAdminByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { admin: true },
  });
  return user?.admin ?? null;
}

/**
 * Update admin permissions
 */
export async function updateAdminPermissions(adminId: string, permissions: object) {
  return prisma.admin.update({
    where: { id: adminId },
    data: { permissions },
  });
}

/**
 * Check if admin has a specific permission
 */
export async function adminHasPermission(
  adminId: string,
  category: string,
  permission: string
): Promise<boolean> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { permissions: true },
  });

  if (!admin?.permissions) return false;

  const perms = admin.permissions as Record<string, Record<string, boolean>>;
  return perms[category]?.[permission] ?? false;
}

/**
 * Check if admin is super admin (has all permissions)
 */
export async function isSuperAdmin(adminId: string): Promise<boolean> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { permissions: true },
  });

  if (!admin?.permissions) return false;

  const perms = admin.permissions as Record<string, Record<string, boolean>>;

  // Super admin has all permissions set to true
  for (const category of Object.values(perms)) {
    for (const value of Object.values(category)) {
      if (value !== true) return false;
    }
  }

  return true;
}
