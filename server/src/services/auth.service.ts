// Accounts: one person, signed in with Discord, acting as one of their roles.
// Everyone is a player; managing a venue and administering the app are roles
// on top, given by invitation (see invitation.service).

import { prisma } from '@db/prisma';
import type { Account, AccountType, AdminPermissions } from '@shared/types';
import { normalizeName, validateName } from '@shared/utils';
import { PERMISSIONS_INCLUDE, permissionsFor } from '@middleware/auth.middleware';

/** The roles a person holds: player always, manager and admin when given */
export function accountRoles(holder: { managerId: string | null; adminId: string | null }): AccountType[] {
  return [
    'player',
    ...(holder.managerId ? ['manager' as const] : []),
    ...(holder.adminId ? ['admin' as const] : []),
  ];
}

/** The roles a person holds now; null when the person no longer exists */
export async function heldRoles(userId: string): Promise<AccountType[] | null> {
  const holder = await prisma.user.findUnique({ where: { id: userId }, select: { managerId: true, adminId: true } });
  return holder ? accountRoles(holder) : null;
}

// What building an account reads of a person
const ACCOUNT_SELECT = {
  id: true,
  name: true,
  onboardedAt: true,
  playerId: true,
  managerId: true,
  adminId: true,
  player: { select: { teamId: true, evaUserId: true, ...PERMISSIONS_INCLUDE.player.select } },
  manager: { select: { managedVenues: { select: { venueId: true } }, ...PERMISSIONS_INCLUDE.manager.select } },
  admin: PERMISSIONS_INCLUDE.admin,
} as const;

/**
 * A person's account, acting as one of their roles; a role they no longer hold
 * reads as player. Null when the person no longer exists.
 */
export async function getAccount(userId: string, accountType: AccountType): Promise<Account | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: ACCOUNT_SELECT });
  if (!user) return null;

  const roles = accountRoles(user);
  const actingAs = roles.includes(accountType) ? accountType : 'player';

  return {
    id: user.id,
    playerId: actingAs === 'player' ? user.playerId : null,
    managerId: actingAs === 'manager' ? user.managerId : null,
    adminId: actingAs === 'admin' ? user.adminId : null,
    name: user.name,
    accountType: actingAs,
    roles,
    isOnboarded: user.onboardedAt !== null,
    hasEvaAccount: user.player.evaUserId !== null,
    permissions: permissionsFor(user, actingAs),
    teamId: actingAs === 'player' ? user.player.teamId : null,
    isLeader: actingAs === 'player' && !!user.player.ledTeam,
    managedVenueIds: actingAs === 'manager' ? user.manager?.managedVenues.map(managed => managed.venueId) ?? [] : null,
    adminPermissions: actingAs === 'admin' ? (user.admin?.permissions as unknown as AdminPermissions) ?? null : null,
  };
}

/**
 * The first-login walk-through is over, done or skipped: it no longer shows.
 * The first time is kept. False while the player has no eva.gg account
 * linked: every player has one, and the walk-through does not end without it.
 */
export async function finishOnboarding(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { player: { select: { evaUserId: true } } } });
  if (!user || user.player.evaUserId === null) return false;
  await prisma.user.updateMany({ where: { id: userId, onboardedAt: null }, data: { onboardedAt: new Date() } });
  return true;
}

/** Change the name a person shows the others; the errors of a name that breaks the rule */
export async function renameAccount(userId: string, name: unknown): Promise<true | string[]> {
  if (typeof name !== 'string') return validateName('') as string[];
  const valid = validateName(name);
  if (valid !== true) return valid;

  await prisma.user.update({ where: { id: userId }, data: { name: normalizeName(name) } });
  return true;
}
