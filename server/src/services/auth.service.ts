// Authentication service - business logic

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@db/prisma';
import type { JwtPayload } from '@middleware/auth.middleware';
import { getUserPermissions } from '@middleware/auth.middleware';
import type { UserPermissions } from '@shared/types';

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
// User data returned to client
// ============================================
export interface AuthUserData {
  id: string;
  email: string;
  name: string;
  permissions: UserPermissions;
  teamId: string | null;
  isLeader: boolean;
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
 * Find user by email (case-insensitive)
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    include: {
      ledTeam: true,
    },
  });
}

/**
 * Find user by ID and return formatted auth data
 */
export async function findUserById(userId: string): Promise<AuthUserData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      ledTeam: true,
    },
  });

  if (!user) return null;

  const permissions = await getUserPermissions(userId);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    permissions,
    teamId: user.teamId,
    isLeader: !!user.ledTeam,
  };
}

/**
 * Build auth user data from user record
 */
export async function buildAuthUserData(user: {
  id: string;
  email: string;
  name: string;
  teamId: string | null;
  ledTeam: { id: string } | null;
}): Promise<AuthUserData> {
  const permissions = await getUserPermissions(user.id);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    permissions,
    teamId: user.teamId,
    isLeader: !!user.ledTeam,
  };
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
}

/**
 * Create a new user
 */
export async function createUser(email: string, hashedPassword: string, name: string) {
  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
    },
  });
}

