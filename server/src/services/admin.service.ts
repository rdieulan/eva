// Admin service - Admin-specific business logic

import { prisma } from '@db/prisma';
import { DEFAULT_ADMIN_PERMISSIONS } from '@shared/types';
import type { AdminPermissions } from '@shared/types';
import { newInvitation } from '@services/invitation.service';

// ============================================
// Admin CRUD operations
// ============================================

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

// An admin, or an invitation to administer not yet accepted (no account yet:
// it shows the name given to it, and the link to send)
export interface AdminSummary {
  id: string;
  userId: string | null;
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
  invitedName: string | null;
  createdAt: Date;
  user: { id: string; name: string } | null;
}): AdminSummary {
  const permissions = (record.permissions ?? DEFAULT_ADMIN_PERMISSIONS) as unknown as AdminPermissions;
  const isPending = !record.user;
  return {
    id: record.id,
    userId: record.user?.id ?? null,
    name: record.user?.name ?? record.invitedName ?? '',
    permissions,
    isSuperAdmin: permissionsAreSuperAdmin(permissions),
    activationPending: isPending,
    activationToken: isPending ? record.activationToken : null,
    activationTokenExpiresAt: isPending ? record.activationTokenExpiresAt : null,
    createdAt: record.createdAt,
  };
}

/**
 * List all admins.
 */
export async function listAdmins(): Promise<AdminSummary[]> {
  const admins = await prisma.admin.findMany({
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return admins.map(toAdminSummary);
}

/**
 * Get a single admin summary by id.
 */
export async function getAdminSummary(adminId: string): Promise<AdminSummary | null> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { user: { select: { id: true, name: true } } },
  });
  return admin ? toAdminSummary(admin) : null;
}

/**
 * Invite someone to administer: the admin exists without an account until
 * someone opens its link and signs in with Discord (see invitation.service).
 * Returns the invitation with its token, for the link to send.
 */
export async function createAdminWithActivation(
  invitedName: string,
  permissions: AdminPermissions,
): Promise<{ admin: AdminSummary; activationToken: string }> {
  const invitation = newInvitation();
  const admin = await prisma.admin.create({
    data: { permissions: permissions as unknown as object, ...invitation, invitedName },
    select: { id: true },
  });

  return { admin: (await getAdminSummary(admin.id))!, activationToken: invitation.activationToken };
}

export type DeleteAdminError = 'notFound' | 'cannotDeleteSelf' | 'lastSuperAdmin';

/**
 * Take the admin role away, or drop an invitation not yet accepted. The person
 * keeps their account: they stay a player. Refuses to:
 * - take it from the admin asking
 * - take it from the last super admin who has an account
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

  // An invitation never accepted leaves nobody without a super admin
  if (target.user && targetIsSuperAdmin) {
    const remainingSuperAdmins = await countSuperAdmins({ excludeId: adminId });
    if (remainingSuperAdmins === 0) return 'lastSuperAdmin';
  }

  // The account forgets the role on its own (SetNull)
  await prisma.admin.delete({ where: { id: adminId } });

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
    select: { permissions: true, user: { select: { id: true } } },
  });
  if (!current) return 'notFound';

  const currentlySuperAdmin = permissionsAreSuperAdmin(
    (current.permissions ?? {}) as unknown as AdminPermissions,
  );
  const willBeSuperAdmin = permissionsAreSuperAdmin(newPermissions);

  if (current.user && currentlySuperAdmin && !willBeSuperAdmin) {
    const remaining = await countSuperAdmins({ excludeId: adminId });
    if (remaining === 0) return 'wouldRemoveLastSuperAdmin';
  }

  await prisma.admin.update({
    where: { id: adminId },
    data: { permissions: newPermissions as unknown as object },
  });

  return (await getAdminSummary(adminId))!;
}

// The super admins who have an account: an invitation not yet accepted administers nothing
async function countSuperAdmins(options: { excludeId?: string } = {}): Promise<number> {
  const admins = await prisma.admin.findMany({
    where: { user: { isNot: null }, ...(options.excludeId && { id: { not: options.excludeId } }) },
    select: { permissions: true },
  });
  return admins.filter(a =>
    permissionsAreSuperAdmin((a.permissions ?? {}) as unknown as AdminPermissions),
  ).length;
}
