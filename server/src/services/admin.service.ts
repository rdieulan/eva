// Admin service - Admin-specific business logic

import { randomUUID } from 'crypto';
import { prisma } from '@db/prisma';
import { DEFAULT_ADMIN_PERMISSIONS } from '@shared/types';
import type { AdminPermissions } from '@shared/types';

// Activation token validity: 7 days
const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================
// Admin CRUD operations
// ============================================

/**
 * Create a new Admin (and associated User account) — used by the bootstrap CLI
 * script. Password is set immediately (no activation flow).
 */
export async function createAdmin(
  email: string,
  hashedPassword: string,
  name: string,
  permissions?: object
) {
  const admin = await prisma.admin.create({
    data: {
      permissions: (permissions ?? DEFAULT_ADMIN_PERMISSIONS) as unknown as object,
    },
  });

  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      adminId: admin.id,
    },
    include: { admin: true },
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
export async function updateAdminPermissions(adminId: string, permissions: AdminPermissions) {
  return prisma.admin.update({
    where: { id: adminId },
    data: { permissions: permissions as unknown as object },
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
 * Check if admin is super admin (has all permissions set to true)
 */
export async function isSuperAdmin(adminId: string): Promise<boolean> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { permissions: true },
  });

  if (!admin?.permissions) return false;

  return permissionsAreSuperAdmin(admin.permissions as unknown as AdminPermissions);
}

function permissionsAreSuperAdmin(perms: AdminPermissions): boolean {
  const flags = perms?.system;
  if (!flags) return false;
  return (
    flags.canManageVenues === true
    && flags.canManageManagers === true
    && flags.canManageAdmins === true
    && flags.canViewAllData === true
  );
}

// ============================================
// Admin management (admin view)
// ============================================

export interface AdminSummary {
  id: string;
  userId: string;
  email: string;
  name: string;
  permissions: AdminPermissions;
  isSuperAdmin: boolean;
  activationPending: boolean;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;
  createdAt: Date;
}

function toAdminSummary(record: {
  id: string;
  permissions: unknown;
  activationToken: string | null;
  activationTokenExpiresAt: Date | null;
  createdAt: Date;
  user: { id: string; email: string; name: string } | null;
}): AdminSummary | null {
  if (!record.user) return null;
  const permissions = (record.permissions ?? DEFAULT_ADMIN_PERMISSIONS) as unknown as AdminPermissions;
  return {
    id: record.id,
    userId: record.user.id,
    email: record.user.email,
    name: record.user.name,
    permissions,
    isSuperAdmin: permissionsAreSuperAdmin(permissions),
    activationPending: !!record.activationToken,
    activationToken: record.activationToken,
    activationTokenExpiresAt: record.activationTokenExpiresAt,
    createdAt: record.createdAt,
  };
}

/**
 * List all admins.
 */
export async function listAdmins(): Promise<AdminSummary[]> {
  const admins = await prisma.admin.findMany({
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return admins.map(toAdminSummary).filter((a): a is AdminSummary => a !== null);
}

/**
 * Get a single admin summary by id.
 */
export async function getAdminSummary(adminId: string): Promise<AdminSummary | null> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  return admin ? toAdminSummary(admin) : null;
}

/**
 * Create an admin with an activation token. Password is set during activation
 * via `POST /api/auth/activate` (same flow as managers).
 */
export async function createAdminWithActivation(
  email: string,
  name: string,
  permissions: AdminPermissions,
): Promise<{ admin: AdminSummary; activationToken: string } | { error: 'emailExists' }> {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();

  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return { error: 'emailExists' };

  const activationToken = randomUUID();
  const activationTokenExpiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    const admin = await tx.admin.create({
      data: {
        permissions: permissions as unknown as object,
        activationToken,
        activationTokenExpiresAt,
      },
    });

    await tx.user.create({
      data: {
        email: normalizedEmail,
        password: randomUUID(),
        name: trimmedName,
        adminId: admin.id,
      },
    });

    return admin;
  });

  const fresh = await prisma.admin.findFirst({
    where: { activationToken },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!fresh || !fresh.user) throw new Error('Failed to load created admin');

  return { admin: toAdminSummary(fresh)!, activationToken };
}

export type DeleteAdminError = 'notFound' | 'cannotDeleteSelf' | 'lastSuperAdmin';

/**
 * Delete an admin (and the linked User). Refuses to delete:
 * - the currently authenticated admin
 * - the last remaining super admin in the system
 */
export async function deleteAdmin(
  adminId: string,
  currentAdminId: string,
): Promise<true | DeleteAdminError> {
  if (adminId === currentAdminId) return 'cannotDeleteSelf';

  const target = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { user: { select: { id: true } } },
  });
  if (!target) return 'notFound';

  const targetIsSuperAdmin = permissionsAreSuperAdmin(
    (target.permissions ?? {}) as unknown as AdminPermissions,
  );

  if (targetIsSuperAdmin) {
    // Count super admins to make sure at least one remains afterwards
    const remainingSuperAdmins = await countSuperAdmins({ excludeId: adminId });
    if (remainingSuperAdmins === 0) return 'lastSuperAdmin';
  }

  await prisma.$transaction([
    ...(target.user ? [prisma.user.delete({ where: { id: target.user.id } })] : []),
    prisma.admin.delete({ where: { id: adminId } }),
  ]);

  return true;
}

export type UpdateAdminError = 'notFound' | 'wouldRemoveLastSuperAdmin';

/**
 * Update an admin's permissions. Refuses to demote the last super admin.
 */
export async function updateAdminGranularPermissions(
  adminId: string,
  newPermissions: AdminPermissions,
): Promise<AdminSummary | UpdateAdminError> {
  const current = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { permissions: true },
  });
  if (!current) return 'notFound';

  const currentlySuperAdmin = permissionsAreSuperAdmin(
    (current.permissions ?? {}) as unknown as AdminPermissions,
  );
  const willBeSuperAdmin = permissionsAreSuperAdmin(newPermissions);

  if (currentlySuperAdmin && !willBeSuperAdmin) {
    const remaining = await countSuperAdmins({ excludeId: adminId });
    if (remaining === 0) return 'wouldRemoveLastSuperAdmin';
  }

  await prisma.admin.update({
    where: { id: adminId },
    data: { permissions: newPermissions as unknown as object },
  });

  return (await getAdminSummary(adminId))!;
}

async function countSuperAdmins(options: { excludeId?: string } = {}): Promise<number> {
  const admins = await prisma.admin.findMany({
    where: options.excludeId ? { id: { not: options.excludeId } } : undefined,
    select: { permissions: true },
  });
  return admins.filter(a =>
    permissionsAreSuperAdmin((a.permissions ?? {}) as unknown as AdminPermissions),
  ).length;
}
