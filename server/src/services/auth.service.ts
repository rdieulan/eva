// Authentication service - business logic

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@db/prisma';
import type { JwtPayload } from '@middleware/auth.middleware';
import type { AccountPermissions } from '@shared/types';

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


// ============================================
// Account types and data returned to client
// ============================================
export type AccountType = 'player' | 'manager' | 'admin';

export interface AuthAccountData {
  id: string;
  email: string;
  name: string;
  accountType: AccountType;
  permissions: AccountPermissions;
  // Player-specific data (null if not a player)
  teamId: string | null;
  isLeader: boolean;
  // Manager-specific data (null if not a manager)
  managedVenueIds: string[] | null;
}

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
export async function getAccountById(userId: string): Promise<AuthAccountData | null> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      player: { include: { ledTeam: true } },
      manager: { include: { managedVenues: true } },
      admin: true,
    },
  });

  if (!account) return null;

  return buildAuthAccountData(account);
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
 * Build auth account data from account record
 */
export async function buildAuthAccountData(account: {
  id: string;
  email: string;
  name: string;
  player?: {
    teamId: string | null;
    ledTeam: { id: string } | null;
  } | null;
  manager?: {
    managedVenues: { venueId: string }[];
  } | null;
  admin?: object | null;
}): Promise<AuthAccountData> {
  // Import dynamically to avoid circular dependency
  const { getAccountPermissions } = await import('@middleware/auth.middleware');
  const permissions = await getAccountPermissions(account.id);

  const accountType = getAccountType(account);

  return {
    id: account.id,
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


