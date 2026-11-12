// Player service - Player-specific business logic

import { prisma } from '@db/prisma';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import type { AccountType, PlayerSubscription } from '@shared/types';
import { formatDateStr } from './helpers/date.helper';

// ============================================
// Player CRUD operations
// ============================================

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
            include: { user: { select: { id: true, name: true } } }
          },
          members: {
            include: { user: { select: { id: true, name: true } } }
          },
          favoriteVenues: { select: { venueId: true }, orderBy: { position: 'asc' } },
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

// ============================================
// Subscription
// ============================================

const SUBSCRIPTION_SELECT = { subscriptionTier: true, subscriptionRenewalDate: true } as const;

function toPlayerSubscription(row: {
  subscriptionTier: PlayerSubscription['tier'];
  subscriptionRenewalDate: Date | null;
}): PlayerSubscription {
  return {
    tier: row.subscriptionTier,
    renewalDate: row.subscriptionRenewalDate ? formatDateStr(row.subscriptionRenewalDate) : null,
  };
}

/**
 * Get the subscription a player entered in their profile (null if no such player)
 */
export async function getPlayerSubscription(playerId: string): Promise<PlayerSubscription | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: SUBSCRIPTION_SELECT,
  });
  return player ? toPlayerSubscription(player) : null;
}

/**
 * Replace a player's subscription. Expects validated input; null clears a field.
 */
export async function updatePlayerSubscription(
  playerId: string,
  subscription: PlayerSubscription,
): Promise<PlayerSubscription> {
  const player = await prisma.player.update({
    where: { id: playerId },
    data: {
      subscriptionTier: subscription.tier,
      // A YYYY-MM-DD string parses as UTC midnight, which is how @db.Date columns are stored
      subscriptionRenewalDate: subscription.renewalDate ? new Date(subscription.renewalDate) : null,
    },
    select: SUBSCRIPTION_SELECT,
  });
  return toPlayerSubscription(player);
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
  name: string | null;
  roles: AccountType[]; // A manager or an admin is a player too
  teamId: string | null;
  teamName: string | null;
  isLeader: boolean;
  evaUsername: string | null; // The eva.gg account linked, for an administrator to free it when it is not theirs
  createdAt: Date;
}

/**
 * List all players with their user + team information (admin view).
 */
export async function listAllPlayers(): Promise<PlayerAdminSummary[]> {
  const players = await prisma.player.findMany({
    include: {
      user: { select: { id: true, name: true, managerId: true, adminId: true } },
      team: { select: { id: true, name: true } },
      ledTeam: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return players.map(p => ({
    id: p.id,
    userId: p.user?.id ?? null,
    name: p.user?.name ?? null,
    roles: [
      'player' as const,
      ...(p.user?.managerId ? ['manager' as const] : []),
      ...(p.user?.adminId ? ['admin' as const] : []),
    ],
    teamId: p.team?.id ?? null,
    teamName: p.team?.name ?? null,
    isLeader: !!p.ledTeam,
    // The three columns of a link are written together: the id says whether there is one
    evaUsername: p.evaUserId !== null ? p.evaUsername : null,
    createdAt: p.createdAt,
  }));
}

export type DeletePlayerError = 'notFound' | 'isTeamLeader' | 'isAdmin' | 'isManager' | 'noUserLinked';

/**
 * Delete a player, that is the person and their account. What they made for
 * their team, its events, searches and proposals, stays with the team, without
 * its author; their invitation links go with them. Refuses to delete a team's
 * leader (delete the team first or transfer leadership), and someone holding a
 * role: a manager's or an admin's goes first from its own list, under its own
 * permission and guards.
 */
export async function deletePlayer(playerId: string): Promise<true | DeletePlayerError> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      user: { select: { id: true, managerId: true, adminId: true } },
      ledTeam: { select: { id: true } },
    },
  });

  if (!player) return 'notFound';
  if (player.ledTeam) return 'isTeamLeader';
  if (!player.user) return 'noUserLinked';
  if (player.user.adminId) return 'isAdmin';
  if (player.user.managerId) return 'isManager';

  // The invitation links first, which the database keeps from going without
  // their author. Deleting the player cascades their account (and its
  // sessions), availabilities and gamePlanPlayers, and clears the author of
  // what they made for the team.
  await prisma.$transaction([
    prisma.teamInvite.deleteMany({ where: { createdById: playerId } }),
    prisma.player.delete({ where: { id: playerId } }),
  ]);

  return true;
}
