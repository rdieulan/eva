// Authentication middleware: who a request acts for, as which role, and what
// that role may do

import type { Request, Response, NextFunction } from 'express';
import type { AccountRole } from '@prisma/client';
import { prisma } from '@db/prisma';
import type { AccountPermissions, AccountType, AdminPermissions } from '@shared/types';
import { DEFAULT_PLAYER_PERMISSIONS, LEADER_PERMISSIONS } from '@shared/types';
import { normalizeAccountPermissions } from '@shared/utils';
import { ERROR } from '@shared/constants';
import { authLogger } from '@utils/logger';
import { findSession } from '@services/session.service';
import type { SessionAccountRecord } from '@services/session.service';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from '@utils/auth-cookies';

/**
 * Who a request acts for, as its session says: one person, acting as one of
 * their roles. Only the id of that role is set: acting as an admin, the same
 * person is no player, so the player's routes refuse them, and the other way round.
 */
export interface SessionAccount {
  userId: string;
  accountType: AccountType;
  playerId?: string;
  managerId?: string;
  adminId?: string;
  // The player's team, when acting as a player
  teamId?: string;
}

export interface AuthRequest extends Request {
  account?: SessionAccount;
}

export const ROLE_OF_ACCOUNT_TYPE: Record<AccountType, AccountRole> = { player: 'PLAYER', manager: 'MANAGER', admin: 'ADMIN' };

/** The role a session acts as, among those its account still holds: a role taken away reads as player */
export function actingRole(holder: { managerId: string | null; adminId: string | null }, role: AccountRole): AccountType {
  if (role === 'ADMIN' && holder.adminId) return 'admin';
  if (role === 'MANAGER' && holder.managerId) return 'manager';
  return 'player';
}

function sessionAccount(record: SessionAccountRecord, role: AccountRole): SessionAccount {
  const accountType = actingRole(record, role);
  return {
    userId: record.id,
    accountType,
    ...(accountType === 'player' && { playerId: record.playerId, teamId: record.player.teamId ?? undefined }),
    ...(accountType === 'manager' && { managerId: record.managerId! }),
    ...(accountType === 'admin' && { adminId: record.adminId! }),
  };
}

/**
 * The session a request carries, read and pushed back when due (the cookie
 * follows); null when it carries none or one that ended, whose cookie goes
 */
export async function readRequestSession(req: Request, res: Response): Promise<SessionAccount | null> {
  const token = readSessionCookie(req);
  if (!token) return null;

  const session = await findSession(token);
  if (!session) {
    clearSessionCookie(res);
    return null;
  }

  if (session.renewedUntil) setSessionCookie(res, token, session.renewedUntil);
  return sessionAccount(session.account, session.role);
}

// What a person's roles may do, as loaded for permissionsFor
export const PERMISSIONS_INCLUDE = {
  player: { select: { permissions: true, ledTeam: { select: { id: true } } } },
  manager: { select: { permissions: true } },
  admin: { select: { permissions: true } },
} as const;

interface PermissionsHolder {
  player: { permissions: unknown; ledTeam: { id: string } | null } | null;
  manager: { permissions: unknown } | null;
  admin: { permissions: unknown } | null;
}

/** What a person may do acting as one of their roles: a team's leader has everything as a player */
export function permissionsFor(holder: PermissionsHolder, accountType: AccountType): AccountPermissions {
  if (accountType === 'admin' && holder.admin) {
    return (holder.admin.permissions as unknown as AccountPermissions) ?? LEADER_PERMISSIONS;
  }
  if (accountType === 'manager' && holder.manager) {
    return (holder.manager.permissions as unknown as AccountPermissions) ?? DEFAULT_PLAYER_PERMISSIONS;
  }
  if (accountType === 'player' && holder.player) {
    return holder.player.ledTeam ? LEADER_PERMISSIONS : normalizeAccountPermissions(holder.player.permissions);
  }
  return DEFAULT_PLAYER_PERMISSIONS;
}

/**
 * Get account permissions from database, for the role the account acts as
 */
export async function getAccountPermissions(userId: string, accountType: AccountType): Promise<AccountPermissions> {
  const holder = await prisma.user.findUnique({ where: { id: userId }, select: PERMISSIONS_INCLUDE });
  return holder ? permissionsFor(holder, accountType) : DEFAULT_PLAYER_PERMISSIONS;
}

/**
 * Check if account has specific permission
 */
export async function hasPermission(
  account: SessionAccount,
  category: keyof AccountPermissions,
  permission: string
): Promise<boolean> {
  const permissions = await getAccountPermissions(account.userId, account.accountType);
  const categoryPerms = permissions[category];
  return (categoryPerms as unknown as Record<string, boolean>)?.[permission] ?? false;
}

/**
 * Authentication middleware - requires an open session. The session's account
 * is read on every request, so a session ended, an account deleted or a role
 * taken away stops here.
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!readSessionCookie(req)) {
    authLogger.debug('Middleware: no session cookie');
    return res.status(401).json({ errors: [ERROR.unauthorized] });
  }

  let account: SessionAccount | null;
  try {
    account = await readRequestSession(req, res);
  } catch (error) {
    authLogger.error('Middleware: session lookup failed:', error);
    return res.status(500).json({ errors: [ERROR.serverError] });
  }
  if (!account) {
    authLogger.debug('Middleware: unknown or expired session');
    return res.status(401).json({ errors: [ERROR.sessionExpired] });
  }

  req.account = account;
  authLogger.debug('Middleware: session of', account.accountType, account.userId);
  next();
}

/**
 * Permission middleware factory - checks for specific permission
 * Usage: requirePermission('planner', 'canEdit')
 */
export function requirePermission(category: keyof AccountPermissions, permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.account) {
      return res.status(401).json({ errors: [ERROR.unauthorized] });
    }

    const allowed = await hasPermission(req.account, category, permission);

    if (!allowed) {
      authLogger.debug(`Permission denied: ${category}.${permission} for account ${req.account.userId}`);
      return res.status(403).json({ errors: [ERROR.forbidden] });
    }

    authLogger.debug(`Permission granted: ${category}.${permission} for account ${req.account.userId}`);
    next();
  };
}

/**
 * Admin middleware - requires the account to act as an admin
 * Must be chained after authMiddleware.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.account) {
    return res.status(401).json({ errors: [ERROR.unauthorized] });
  }

  if (!req.account.adminId) {
    authLogger.debug('Admin access denied for', req.account.userId);
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
      authLogger.debug(`Admin permission denied: ${permission} for ${req.account.userId}`);
      return res.status(403).json({ errors: [ERROR.forbidden] });
    }

    next();
  };
}
