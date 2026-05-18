// Team service - business logic

import { prisma } from '@db/prisma';
import type { AccountPermissions } from '@shared/types';
import { LEADER_PERMISSIONS, DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import { DEFAULT_ASSIGNMENTS, DEFAULT_GAME_PLAN_NOTES, ERROR } from '@shared/constants';

// ============================================
// Types
// ============================================
export interface TeamCreateData {
  name: string;
  logo?: string | null;
  venueId?: string | null;
  leaderId: string;
}

export interface TeamUpdateData {
  name?: string;
  logo?: string | null;
  venueId?: string | null;
}

export interface MemberWithRole {
  id: string;
  name: string;
  email: string;
  permissions: unknown;
  isLeader: boolean;
}

// Re-export player helpers for convenience
export { getPlayerWithTeam, getPlayerTeam } from '@services/player.service';

// ============================================
// Admin view (read-only)
// ============================================

export interface TeamAdminMember {
  id: string;
  playerId: string;
  email: string;
  name: string;
  isLeader: boolean;
}

export interface TeamAdminSummary {
  id: string;
  name: string;
  logo: string | null;
  venue: { id: string; name: string; city: string } | null;
  leader: { id: string; name: string; email: string } | null;
  memberCount: number;
  createdAt: Date;
}

export interface TeamAdminDetail extends TeamAdminSummary {
  members: TeamAdminMember[];
}

/**
 * List all teams with summary information (admin view).
 */
export async function listAllTeams(): Promise<TeamAdminSummary[]> {
  const teams = await prisma.team.findMany({
    include: {
      venue: { select: { id: true, name: true, city: true } },
      leader: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return teams.map(t => ({
    id: t.id,
    name: t.name,
    logo: t.logo,
    venue: t.venue,
    leader: t.leader?.user
      ? { id: t.leader.user.id, name: t.leader.user.name, email: t.leader.user.email }
      : null,
    memberCount: t._count.members,
    createdAt: t.createdAt,
  }));
}

/**
 * Get a team with full member list (admin view).
 */
export async function getTeamAdminDetail(teamId: string): Promise<TeamAdminDetail | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      venue: { select: { id: true, name: true, city: true } },
      leader: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!team) return null;

  const members: TeamAdminMember[] = team.members
    .filter(p => p.user !== null)
    .map(p => ({
      id: p.user!.id,
      playerId: p.id,
      email: p.user!.email,
      name: p.user!.name,
      isLeader: p.id === team.leaderId,
    }));

  return {
    id: team.id,
    name: team.name,
    logo: team.logo,
    venue: team.venue,
    leader: team.leader?.user
      ? { id: team.leader.user.id, name: team.leader.user.name, email: team.leader.user.email }
      : null,
    memberCount: members.length,
    createdAt: team.createdAt,
    members,
  };
}

// ============================================
// Team operations
// ============================================

/**
 * Create a new team with the user as leader
 */
export async function createTeam(data: TeamCreateData) {
  // Check if user already has a team (via Player)
  const user = await prisma.user.findUnique({
    where: { id: data.leaderId },
    include: { player: true },
  });

  if (!user?.player) {
    return { error: ERROR.userNotFound };
  }

  if (user.player.teamId) {
    return { error: ERROR.userAlreadyInTeam };
  }

  // Create team with current player as leader
  const team = await prisma.team.create({
    data: {
      name: data.name.trim(),
      logo: data.logo || null,
      leader: { connect: { id: user.player.id } },
      members: { connect: { id: user.player.id } },
    },
  });

  // Update player with leader permissions and teamId
  await prisma.player.update({
    where: { id: user.player.id },
    data: {
      teamId: team.id,
      permissions: LEADER_PERMISSIONS as unknown as object,
    },
  });

  // Create default game plans for each map
  const allMaps = await prisma.map.findMany();
  await prisma.gamePlan.createMany({
    data: allMaps.map(map => ({
      name: 'Default',
      mapId: map.id,
      teamId: team.id,
      assignments: DEFAULT_ASSIGNMENTS as unknown as object[],
      notes: DEFAULT_GAME_PLAN_NOTES as unknown as object,
    })),
  });

  return { team, isLeader: true };
}

/**
 * Update team info
 */
export async function updateTeam(teamId: string, data: TeamUpdateData) {
  // Validate venue exists if provided
  if (data.venueId) {
    const venue = await prisma.venue.findUnique({ where: { id: data.venueId } });
    if (!venue) {
      return { error: ERROR.venueNotFound };
    }
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.logo !== undefined && { logo: data.logo }),
      ...(data.venueId !== undefined && { venueId: data.venueId }),
    },
  });

  return { team };
}

/**
 * Get team members with roles
 */
export async function getTeamMembers(teamId: string): Promise<MemberWithRole[]> {
  const players = await prisma.player.findMany({
    where: { teamId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      ledTeam: { select: { id: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return players.map(player => ({
    id: player.user!.id,
    name: player.user!.name,
    email: player.user!.email,
    permissions: player.permissions,
    isLeader: !!player.ledTeam,
  }));
}

/**
 * Update member permissions
 */
export async function updateMemberPermissions(
  currentUserId: string,
  memberId: string,
  permissions: AccountPermissions
): Promise<{ success: boolean; error?: string }> {
  // Get current user's player and team
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: { player: { include: { team: true } } },
  });

  if (!currentUser?.player?.team) {
    return { success: false, error: ERROR.teamNotFound };
  }

  // Find the target user and their player
  const targetUser = await prisma.user.findUnique({
    where: { id: memberId },
    include: { player: { include: { ledTeam: true } } },
  });

  if (!targetUser?.player || targetUser.player.teamId !== currentUser.player.team.id) {
    return { success: false, error: ERROR.memberNotFound };
  }

  // Cannot modify leader's permissions
  if (targetUser.player.ledTeam) {
    return { success: false, error: ERROR.cannotModifyLeaderPermissions };
  }

  // Cannot modify own permissions
  if (memberId === currentUserId) {
    return { success: false, error: ERROR.cannotModifyOwnPermissions };
  }

  await prisma.player.update({
    where: { id: targetUser.player.id },
    data: { permissions: permissions as unknown as object },
  });

  return { success: true };
}

/**
 * Remove a member from team
 */
export async function removeMember(
  currentUserId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: { player: { include: { team: true } } },
  });

  if (!currentUser?.player?.team) {
    return { success: false, error: ERROR.teamNotFound };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: memberId },
    include: { player: { include: { ledTeam: true } } },
  });

  if (!targetUser?.player || targetUser.player.teamId !== currentUser.player.team.id) {
    return { success: false, error: ERROR.memberNotFound };
  }

  // Cannot remove the leader
  if (targetUser.player.ledTeam) {
    return { success: false, error: ERROR.cannotRemoveLeader };
  }

  // Cannot remove yourself
  if (memberId === currentUserId) {
    return { success: false, error: ERROR.cannotRemoveSelf };
  }

  await prisma.player.update({
    where: { id: targetUser.player.id },
    data: {
      teamId: null,
      permissions: DEFAULT_PLAYER_PERMISSIONS as unknown as object,
    },
  });

  return { success: true };
}

/**
 * Delete a team (leader only)
 */
export async function deleteTeam(playerId: string): Promise<{ success: boolean; error?: string }> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true, ledTeam: true },
  });

  if (!player?.team) {
    return { success: false, error: ERROR.teamNotFound };
  }

  if (!player.ledTeam) {
    return { success: false, error: ERROR.onlyLeaderCanDelete };
  }

  const teamId = player.team.id;

  // Reset permissions and remove teamId from all players in the team
  await prisma.player.updateMany({
    where: { teamId },
    data: {
      teamId: null,
      permissions: DEFAULT_PLAYER_PERMISSIONS as unknown as object,
    },
  });

  // Delete the team
  await prisma.team.delete({
    where: { id: teamId },
  });

  return { success: true };
}

/**
 * Leave team (for non-leader members)
 */
export async function leaveTeam(playerId: string): Promise<{ success: boolean; error?: string }> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { team: true, ledTeam: true },
  });

  if (!player?.team) {
    return { success: false, error: ERROR.teamNotFound };
  }

  if (player.ledTeam) {
    return { success: false, error: ERROR.leaderCannotLeave };
  }

  await prisma.player.update({
    where: { id: playerId },
    data: {
      teamId: null,
      permissions: DEFAULT_PLAYER_PERMISSIONS as unknown as object,
    },
  });

  return { success: true };
}
