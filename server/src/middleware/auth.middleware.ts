// Authentication middleware

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@db/prisma';
import type { UserPermissions } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS, LEADER_PERMISSIONS } from '@shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

export interface JwtPayload {
  userId: string;
  email: string;
  teamId?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Get user's team ID from database
 */
export async function getUserTeamId(userId: string): Promise<string | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true },
  });
  return user?.teamId ?? undefined;
}

/**
 * Get user permissions from database
 * Leaders get full permissions, others get stored permissions or defaults
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { ledTeam: true },
  });

  if (!user) return DEFAULT_PLAYER_PERMISSIONS;

  // If user is a leader, grant full permissions
  if (user.ledTeam) {
    return LEADER_PERMISSIONS;
  }

  // Return stored permissions or defaults
  return (user.permissions as unknown as UserPermissions) ?? DEFAULT_PLAYER_PERMISSIONS;
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(
  userId: string,
  category: keyof UserPermissions,
  permission: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  const categoryPerms = permissions[category];
  return (categoryPerms as unknown as Record<string, boolean>)?.[permission] ?? false;
}

/**
 * Authentication middleware - requires valid JWT token
 * Enriches the payload with teamId from database
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] Middleware: Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    console.log('[AUTH] Middleware: Invalid token');
    return res.status(401).json({ error: 'Token invalide' });
  }

  // Enrich payload with teamId from database
  getUserTeamId(payload.userId).then(teamId => {
    console.log('[AUTH] Middleware: Token valid for user', payload.email, 'team:', teamId);
    req.user = { ...payload, teamId };
    next();
  }).catch(error => {
    console.error('[AUTH] Error fetching team:', error);
    req.user = payload;
    next();
  });
}

/**
 * Permission middleware factory - checks for specific permission
 * Usage: requirePermission('planner', 'canEdit')
 */
export function requirePermission(category: keyof UserPermissions, permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const allowed = await hasPermission(req.user.userId, category, permission);

    if (!allowed) {
      console.log(`[AUTH] Permission denied: ${category}.${permission} for user ${req.user.email}`);
      return res.status(403).json({ error: 'Permission refusée' });
    }

    console.log(`[AUTH] Permission granted: ${category}.${permission} for user ${req.user.email}`);
    next();
  };
}
