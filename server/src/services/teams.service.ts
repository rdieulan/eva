// Team service - business logic

import { prisma } from '@db/prisma';
import type { UserPermissions } from '@shared/types';
import { LEADER_PERMISSIONS, DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import { DEFAULT_ASSIGNMENTS, DEFAULT_GAME_PLAN_NOTES } from '@shared/constants';

// ============================================
// Types
// ============================================
export interface TeamCreateData {
  name: string;
  logo?: string | null;
  location?: string | null;
  leaderId: string;
}

export interface TeamUpdateData {
  name?: string;
  logo?: string | null;
  location?: string | null;
}

export interface MemberWithRole {
  id: string;
  name: string;
  email: string;
  permissions: unknown;
  isLeader: boolean;
}

// ============================================
// User helpers
// ============================================

/**
 * Check if user already has a team
 */
export async function getUserWithTeam(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: {
        include: {
          leader: { select: { id: true, name: true, email: true } },
          members: { select: { id: true, name: true, email: true, permissions: true } },
        },
      },
      ledTeam: true,
    },
  });
}

/**
 * Verify user belongs to a team and return their team
 */
export async function getUserTeam(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { team: true },
  });
  return user?.team || null;
}

// ============================================
// Team operations
// ============================================

/**
 * Create a new team with the user as leader
 */
export async function createTeam(data: TeamCreateData) {
  // Check if user already has a team
  const user = await prisma.user.findUnique({
    where: { id: data.leaderId },
  });

  if (user?.teamId) {
    return { error: 'Vous êtes déjà membre d\'une équipe' };
  }

  // Create team with current user as leader
  const team = await prisma.team.create({
    data: {
      name: data.name.trim(),
      logo: data.logo || null,
      location: data.location || null,
      leader: { connect: { id: data.leaderId } },
      members: { connect: { id: data.leaderId } },
    },
  });

  // Update user with leader permissions
  await prisma.user.update({
    where: { id: data.leaderId },
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
  return prisma.team.update({
    where: { id: teamId },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.logo !== undefined && { logo: data.logo }),
      ...(data.location !== undefined && { location: data.location }),
    },
  });
}

/**
 * Get team members with roles
 */
export async function getTeamMembers(teamId: string): Promise<MemberWithRole[]> {
  const members = await prisma.user.findMany({
    where: { teamId },
    select: {
      id: true,
      name: true,
      email: true,
      permissions: true,
      ledTeam: { select: { id: true } },
    },
    orderBy: { name: 'asc' },
  });

  return members.map(member => ({
    id: member.id,
    name: member.name,
    email: member.email,
    permissions: member.permissions,
    isLeader: !!member.ledTeam,
  }));
}

/**
 * Update member permissions
 */
export async function updateMemberPermissions(
  currentUserId: string,
  memberId: string,
  permissions: UserPermissions
): Promise<{ success: boolean; error?: string }> {
  // Get current user's team
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: { team: true },
  });

  if (!currentUser?.team) {
    return { success: false, error: 'Aucune équipe trouvée' };
  }

  // Verify target member is in the same team
  const targetMember = await prisma.user.findUnique({
    where: { id: memberId },
    include: { ledTeam: true },
  });

  if (!targetMember || targetMember.teamId !== currentUser.team.id) {
    return { success: false, error: 'Membre non trouvé dans cette équipe' };
  }

  // Cannot modify leader's permissions
  if (targetMember.ledTeam) {
    return { success: false, error: 'Impossible de modifier les permissions du leader' };
  }

  // Cannot modify own permissions
  if (memberId === currentUserId) {
    return { success: false, error: 'Impossible de modifier vos propres permissions' };
  }

  await prisma.user.update({
    where: { id: memberId },
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
    include: { team: true },
  });

  if (!currentUser?.team) {
    return { success: false, error: 'Aucune équipe trouvée' };
  }

  const targetMember = await prisma.user.findUnique({
    where: { id: memberId },
    include: { ledTeam: true },
  });

  if (!targetMember || targetMember.teamId !== currentUser.team.id) {
    return { success: false, error: 'Membre non trouvé dans cette équipe' };
  }

  // Cannot remove the leader
  if (targetMember.ledTeam) {
    return { success: false, error: 'Impossible de retirer le leader de l\'équipe' };
  }

  // Cannot remove yourself
  if (memberId === currentUserId) {
    return { success: false, error: 'Impossible de vous retirer vous-même' };
  }

  await prisma.user.update({
    where: { id: memberId },
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
export async function deleteTeam(userId: string): Promise<{ success: boolean; error?: string }> {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: true,
      ledTeam: true,
    },
  });

  if (!currentUser?.team) {
    return { success: false, error: 'Aucune équipe trouvée' };
  }

  if (!currentUser.ledTeam) {
    return { success: false, error: 'Seul le leader peut supprimer l\'équipe' };
  }

  const teamId = currentUser.team.id;

  // Reset permissions and remove teamId from all members
  await prisma.user.updateMany({
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
export async function leaveTeam(userId: string): Promise<{ success: boolean; error?: string }> {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      team: true,
      ledTeam: true,
    },
  });

  if (!currentUser?.team) {
    return { success: false, error: 'Aucune équipe trouvée' };
  }

  if (currentUser.ledTeam) {
    return { success: false, error: 'Le leader ne peut pas quitter l\'équipe. Supprimez l\'équipe ou transférez la direction.' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      teamId: null,
      permissions: DEFAULT_PLAYER_PERMISSIONS as unknown as object,
    },
  });

  return { success: true };
}
