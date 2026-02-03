// Authentication service - business logic

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@db/prisma';
import type { JwtPayload } from '@middleware/auth.middleware';
import type { AccountPermissions, Account, AccountType } from '@shared/types';

// Re-export validation functions from shared (single source of truth)
export {
  validateEmail,
  validatePassword,
  validateName,
  validatePasswordsMatch,
  validateRegistration,
  isValidEmail,
  isValidPassword,
  isValidName,
  type ValidationResult,
} from '@shared/utils';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';


// Re-export Account type for backward compatibility
export type { Account, AccountType };

/**
 * Generate a JWT token
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a session for a user
 */
export async function createSession(userId: string, token: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
}

/**
 * Delete a session by token
 */
export async function deleteSession(token: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { token } });
  return result.count;
}

/**
 * Check if an email already exists (for registration uniqueness check)
 */
export async function emailExists(email: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
  });
  return count > 0;
}

/**
 * Find account by email for authentication (login, change-password)
 * Returns Account with Player/Manager/Admin relations for building auth data
 */
export async function findAccountByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    include: {
      player: { include: { ledTeam: true } },
      manager: { include: { managedVenues: true } },
      admin: true,
    },
  });
}

/**
 * Get account by ID and return formatted auth data
 */
export async function getAccountById(userId: string): Promise<Account | null> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      player: { include: { ledTeam: true } },
      manager: { include: { managedVenues: true } },
      admin: true,
    },
  });

  if (!account) return null;

  return buildAccountData(account);
}

/**
 * Determine account type from account record
 */
function getAccountType(account: {
  player?: unknown | null;
  manager?: unknown | null;
  admin?: unknown | null;
}): AccountType {
  if (account.admin) return 'admin';
  if (account.manager) return 'manager';
  return 'player';
}

/**
 * Build account data from account record
 */
export async function buildAccountData(account: {
  id: string;
  email: string;
  name: string;
  playerId?: string | null;
  managerId?: string | null;
  adminId?: string | null;
  player?: {
    id: string;
    teamId: string | null;
    ledTeam: { id: string } | null;
  } | null;
  manager?: {
    id: string;
    managedVenues: { venueId: string }[];
  } | null;
  admin?: {
    id: string;
  } | null;
}): Promise<Account> {
  // Import dynamically to avoid circular dependency
  const { getAccountPermissions } = await import('@middleware/auth.middleware');
  const permissions = await getAccountPermissions(account.id);

  const accountType = getAccountType(account);

  return {
    id: account.id,
    playerId: account.player?.id ?? account.playerId ?? null,
    managerId: account.manager?.id ?? account.managerId ?? null,
    adminId: account.admin?.id ?? account.adminId ?? null,
    email: account.email,
    name: account.name,
    accountType,
    permissions,
    // Player-specific
    teamId: account.player?.teamId ?? null,
    isLeader: !!account.player?.ledTeam,
    // Manager-specific
    managedVenueIds: account.manager?.managedVenues.map(v => v.venueId) ?? null,
  };
}

/**
 * Update account password
 */
export async function updateAccountPassword(userId: string, hashedPassword: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
}

// ============================================
// Activation (for Manager accounts)
// ============================================

/**
 * Find manager by activation token
 */
export async function findManagerByActivationToken(token: string) {
  return prisma.manager.findFirst({
    where: {
      activationToken: token,
      activationTokenExpiresAt: { gte: new Date() },
    },
    include: {
      user: true,
    },
  });
}

/**
 * Activate manager account (set password and clear activation token)
 */
export async function activateManagerAccount(managerId: string, userId: string, hashedPassword: string): Promise<void> {
  await prisma.$transaction([
    prisma.manager.update({
      where: { id: managerId },
      data: {
        activationToken: null,
        activationTokenExpiresAt: null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    }),
  ]);
}

// ============================================
// Linked accounts
// ============================================

/**
 * Link two accounts together
 */
export async function linkAccounts(userId1: string, userId2: string): Promise<{ groupId: string }> {
  // Get both accounts
  const [account1, account2] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId1 } }),
    prisma.user.findUnique({ where: { id: userId2 } }),
  ]);

  if (!account1 || !account2) {
    throw new Error('Account not found');
  }

  // Check if either already has a group
  const existingGroupId = account1.linkedAccountGroupId || account2.linkedAccountGroupId;

  if (existingGroupId) {
    // Add the other account to the existing group
    const accountToAdd = account1.linkedAccountGroupId ? account2 : account1;
    await prisma.user.update({
      where: { id: accountToAdd.id },
      data: { linkedAccountGroupId: existingGroupId },
    });
    return { groupId: existingGroupId };
  }

  // Create new group and link both accounts
  const group = await prisma.linkedAccountGroup.create({
    data: {
      accounts: {
        connect: [{ id: userId1 }, { id: userId2 }],
      },
    },
  });

  return { groupId: group.id };
}

/**
 * Linked account summary for account switching
 */
export interface LinkedAccountSummary {
  id: string;
  email: string;
  name: string;
  accountType: 'player' | 'manager' | 'admin';
  isCurrent: boolean;
}

/**
 * Get all accounts in a linked group (including current)
 */
export async function getLinkedAccounts(userId: string): Promise<LinkedAccountSummary[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { linkedAccountGroupId: true },
  });

  if (!user?.linkedAccountGroupId) {
    // Return only the current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { player: true, manager: true, admin: true },
    });
    if (!currentUser) return [];

    return [{
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      accountType: currentUser.admin ? 'admin' : currentUser.manager ? 'manager' : 'player',
      isCurrent: true,
    }];
  }

  const linkedUsers = await prisma.user.findMany({
    where: {
      linkedAccountGroupId: user.linkedAccountGroupId,
    },
    include: {
      player: true,
      manager: true,
      admin: true,
    },
  });

  return linkedUsers.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    accountType: u.admin ? 'admin' : u.manager ? 'manager' : 'player' as const,
    isCurrent: u.id === userId,
  }));
}

/**
 * Check if target account is in the same linked group
 */
export async function isAccountInSameGroup(currentUserId: string, targetUserId: string): Promise<boolean> {
  const [current, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: currentUserId }, select: { linkedAccountGroupId: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, select: { linkedAccountGroupId: true } }),
  ]);

  if (!current?.linkedAccountGroupId || !target?.linkedAccountGroupId) {
    return false;
  }

  return current.linkedAccountGroupId === target.linkedAccountGroupId;
}
