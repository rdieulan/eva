// Player service - Player-specific business logic

import { randomUUID } from 'crypto';
import { prisma } from '@db/prisma';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';

// Password reset tokens live 24h
const PASSWORD_RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================
// Player CRUD operations
// ============================================

/**
 * Create a new Player (and associated User account)
 */
export async function createPlayer(email: string, hashedPassword: string, name: string) {
  // Create Player first
  const player = await prisma.player.create({
    data: {},
  });

  // Create User account linked to Player
  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      playerId: player.id,
    },
    include: {
      player: true,
    },
  });
}

/**
 * Get player by ID with user data
 */
export async function getPlayerById(playerId: string) {
  return prisma.player.findUnique({
    where: { id: playerId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      team: true,
      ledTeam: true,
    },
  });
}

/**
 * Get player by user ID
 */
export async function getPlayerByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      player: {
        include: {
          team: true,
          ledTeam: true,
        },
      },
    },
  });
  return user?.player ?? null;
}

/**
 * Get player with team data directly from Player table
 */
export async function getPlayerWithTeam(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      team: {
        include: {
          leader: {
            include: { user: { select: { id: true, name: true, email: true } } }
          },
          members: {
            include: { user: { select: { id: true, name: true, email: true } } }
          },
        },
      },
      ledTeam: true,
    },
  });

  if (!player) return null;

  return {
    team: player.team,
    ledTeam: player.ledTeam,
  };
}

/**
 * Get player's team directly from Player table
 */
export async function getPlayerTeam(playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true },
  });
  return player?.team || null;
}

/**
 * Get player's team ID directly from Player table
 */
export async function getPlayerTeamId(playerId: string): Promise<string | undefined> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  });
  return player?.teamId ?? undefined;
}

/**
 * Update player permissions
 */
export async function updatePlayerPermissions(playerId: string, permissions: object) {
  return prisma.player.update({
    where: { id: playerId },
    data: { permissions },
  });
}

/**
 * Reset player permissions to default
 */
export async function resetPlayerPermissions(playerId: string) {
  return prisma.player.update({
    where: { id: playerId },
    data: { permissions: DEFAULT_PLAYER_PERMISSIONS as unknown as object },
  });
}

/**
 * Verify player belongs to the specified team
 */
export async function verifyPlayerBelongsToTeam(playerId: string, teamId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, teamId: true },
  });
  return player?.teamId === teamId ? player : null;
}

// ============================================
// Admin view (read-only)
// ============================================

export interface PlayerAdminSummary {
  id: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  teamId: string | null;
  teamName: string | null;
  isLeader: boolean;
  createdAt: Date;
}

/**
 * List all players with their user + team information (admin view).
 */
export async function listAllPlayers(): Promise<PlayerAdminSummary[]> {
  const players = await prisma.player.findMany({
    include: {
      user: { select: { id: true, email: true, name: true } },
      team: { select: { id: true, name: true } },
      ledTeam: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return players.map(p => ({
    id: p.id,
    userId: p.user?.id ?? null,
    email: p.user?.email ?? null,
    name: p.user?.name ?? null,
    teamId: p.team?.id ?? null,
    teamName: p.team?.name ?? null,
    isLeader: !!p.ledTeam,
    createdAt: p.createdAt,
  }));
}

export type DeletePlayerError = 'notFound' | 'isTeamLeader' | 'noUserLinked';

/**
 * Delete a Player and the linked User account, cleaning up dependents that
 * have a RESTRICT FK (CalendarEvent.createdById, TeamInvite.createdById).
 * Refuses to delete a Player who is currently the leader of a team — the
 * caller should delete the team first or transfer leadership.
 */
export async function deletePlayer(playerId: string): Promise<true | DeletePlayerError> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      user: { select: { id: true } },
      ledTeam: { select: { id: true } },
    },
  });

  if (!player) return 'notFound';
  if (player.ledTeam) return 'isTeamLeader';
  if (!player.user) return 'noUserLinked';

  // Order matters: clear RESTRICT-FK dependents before deleting Player; Player
  // delete cascades availabilities and gamePlanPlayers. User is deleted last
  // because User.playerId is SetNull on Player delete (deleting Player only
  // nulls the FK, the User row stays unless we remove it explicitly).
  await prisma.$transaction([
    prisma.calendarEvent.deleteMany({ where: { createdById: playerId } }),
    prisma.teamInvite.deleteMany({ where: { createdById: playerId } }),
    prisma.player.delete({ where: { id: playerId } }),
    prisma.user.delete({ where: { id: player.user.id } }),
  ]);

  return true;
}

export type PasswordResetError = 'notFound' | 'noUserLinked';

export interface PasswordResetResult {
  token: string;
  expiresAt: Date;
  userEmail: string;
}

/**
 * Generate a password reset token for the User behind this Player. Returns
 * the token + expiry so the admin can forward a reset link to the user.
 * Overwrites any previous unused token.
 */
export async function generatePasswordResetTokenForPlayer(
  playerId: string,
): Promise<PasswordResetResult | PasswordResetError> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!player) return 'notFound';
  if (!player.user) return 'noUserLinked';

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: player.user.id },
    data: { passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt },
  });

  return { token, expiresAt, userEmail: player.user.email };
}
