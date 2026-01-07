// Authentication service - business logic

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@db/prisma';
import type { JwtPayload } from '@middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
 * Find user by email
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/**
 * Find user by ID
 */
export async function findUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });
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
