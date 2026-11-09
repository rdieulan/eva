// Authentication middleware

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@db/prisma';
import type { AccountPermissions, AccountType, AdminPermissions } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS, LEADER_PERMISSIONS } from '@shared/types';
import { normalizeAccountPermissions } from '@shared/utils';
import { ERROR } from '@shared/constants';
import { authLogger } from '@utils/logger';
import { findSession } from '@services/session.service';
import type { SessionAccountRecord } from '@services/session.service';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from '@utils/session-cookie';

/** Who a request acts for, as its session says */
export interface SessionAccount {
  userId: string;
  email: string;
  accountType: AccountType;
  // Type-specific IDs (only one will be set)
  playerId?: string;
  managerId?: string;
  adminId?: string;
  // The player's team, if any
  teamId?: string;
}

export interface AuthRequest extends Request {
  account?: SessionAccount;
}

function sessionAccount(record: SessionAccountRecord): SessionAccount {
  return {
    userId: record.id,
    email: record.email,
    accountType: record.adminId ? 'admin' : record.managerId ? 'manager' : 'player',
    playerId: record.playerId ?? undefined,
    managerId: record.managerId ?? undefined,
    adminId: record.adminId ?? undefined,
    teamId: record.player?.teamId ?? undefined,
  };
}

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
    return normalizeAccountPermissions(account.player.permissions);
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
 * Authentication middleware - requires an open session. The session's account
 * is read on every request, so a session ended or an account deleted stops here.
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = readSessionCookie(req);
  if (!token) {
    authLogger.debug('Middleware: no session cookie');
    return res.status(401).json({ errors: [ERROR.unauthorized] });
  }

  let session: Awaited<ReturnType<typeof findSession>>;
  try {
    session = await findSession(token);
  } catch (error) {
    authLogger.error('Middleware: session lookup failed:', error);
    return res.status(500).json({ errors: [ERROR.serverError] });
  }
  if (!session) {
    authLogger.debug('Middleware: unknown or expired session');
    clearSessionCookie(res);
    return res.status(401).json({ errors: [ERROR.sessionExpired] });
  }

  if (session.renewedUntil) setSessionCookie(res, token, session.renewedUntil);
  req.account = sessionAccount(session.account);
  authLogger.debug('Middleware: session of', req.account.accountType, req.account.email);
  next();
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
