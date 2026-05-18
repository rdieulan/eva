// Player service - Player-specific business logic

import { prisma } from '@db/prisma';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';

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
