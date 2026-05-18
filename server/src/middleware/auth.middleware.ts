// Authentication middleware

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@db/prisma';
import type { AccountPermissions, AccountType, AdminPermissions } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS, LEADER_PERMISSIONS } from '@shared/types';
import { ERROR } from '@shared/constants';
import { authLogger } from '@utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// Security warning for production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  authLogger.error('WARNING: JWT_SECRET not set in production! Using insecure default.');
}

export interface JwtPayload {
  userId: string;
  email: string;
  accountType?: AccountType;
  // Type-specific IDs (only one will be set)
  playerId?: string;
  managerId?: string;
  adminId?: string;
  // Player-specific (enriched by middleware)
  teamId?: string;
}

export interface AuthRequest extends Request {
  account?: JwtPayload;
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

// Import player helpers
import { getPlayerTeamId } from '@services/player.service';

/**
 * Get account permissions from database
 * Detects account type (Player, Manager, Admin) and returns appropriate permissions
 */
export async function getAccountPermissions(userId: string): Promise<AccountPermissions> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      player: { include: { ledTeam: true } },
      manager: true,
      admin: true,
    },
  });

  // Admin permissions
  if (account?.admin) {
    return (account.admin.permissions as unknown as AccountPermissions) ?? LEADER_PERMISSIONS;
  }

  // Manager permissions
  if (account?.manager) {
    return (account.manager.permissions as unknown as AccountPermissions) ?? DEFAULT_PLAYER_PERMISSIONS;
  }

  // Player permissions
  if (account?.player) {
    // If player is a leader, grant full permissions
    if (account.player.ledTeam) {
      return LEADER_PERMISSIONS;
    }
    return (account.player.permissions as unknown as AccountPermissions) ?? DEFAULT_PLAYER_PERMISSIONS;
  }

  return DEFAULT_PLAYER_PERMISSIONS;
}

/**
 * Check if account has specific permission
 */
export async function hasPermission(
  userId: string,
  category: keyof AccountPermissions,
  permission: string
): Promise<boolean> {
  const permissions = await getAccountPermissions(userId);
  const categoryPerms = permissions[category];
  return (categoryPerms as unknown as Record<string, boolean>)?.[permission] ?? false;
}

/**
 * Authentication middleware - requires valid JWT token
 * Enriches the payload with teamId from database (for Players only)
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    authLogger.debug('Middleware: Missing or invalid Authorization header');
    return res.status(401).json({ errors: [ERROR.tokenMissing] });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    authLogger.debug('Middleware: Invalid token');
    return res.status(401).json({ errors: [ERROR.tokenInvalid] });
  }

  // Enrich payload with teamId from database (only for Players)
  if (payload.playerId) {
    getPlayerTeamId(payload.playerId).then(teamId => {
      authLogger.debug('Middleware: Token valid for player', payload.email, 'team:', teamId);
      req.account = { ...payload, teamId };
      next();
    }).catch(error => {
      authLogger.error('Error fetching team:', error);
      req.account = payload;
      next();
    });
  } else {
    // Manager or Admin - no teamId needed
    authLogger.debug('Middleware: Token valid for', payload.accountType, payload.email);
    req.account = payload;
    next();
  }
}

/**
 * Permission middleware factory - checks for specific permission
 * Usage: requirePermission('planner', 'canEdit')
 */
export function requirePermission(category: keyof AccountPermissions, permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.account) {
      return res.status(401).json({ errors: ['Non authentifié'] });
    }

    const allowed = await hasPermission(req.account.userId, category, permission);

    if (!allowed) {
      authLogger.debug(`Permission denied: ${category}.${permission} for account ${req.account.email}`);
      return res.status(403).json({ errors: ['Permission refusée'] });
    }

    authLogger.debug(`Permission granted: ${category}.${permission} for account ${req.account.email}`);
    next();
  };
}

/**
 * Admin middleware - requires the account to be an admin
 * Must be chained after authMiddleware.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.account) {
    return res.status(401).json({ errors: [ERROR.unauthorized] });
  }

  if (!req.account.adminId) {
    authLogger.debug('Admin access denied for', req.account.email);
    return res.status(403).json({ errors: [ERROR.adminRequired] });
  }

  next();
}

/**
 * Admin permission middleware factory - checks for a specific admin permission
 * Usage: requireAdminPermission('canManageVenues')
 * Must be chained after authMiddleware + requireAdmin (or used directly after authMiddleware).
 */
export function requireAdminPermission(permission: keyof AdminPermissions['system']) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.account) {
      return res.status(401).json({ errors: [ERROR.unauthorized] });
    }

    if (!req.account.adminId) {
      return res.status(403).json({ errors: [ERROR.adminRequired] });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.account.adminId },
      select: { permissions: true },
    });

    const perms = (admin?.permissions ?? {}) as unknown as AdminPermissions;
    const allowed = perms.system?.[permission] === true;

    if (!allowed) {
      authLogger.debug(`Admin permission denied: ${permission} for ${req.account.email}`);
      return res.status(403).json({ errors: [ERROR.forbidden] });
    }

    next();
  };
}
