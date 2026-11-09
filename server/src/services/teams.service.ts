// Team service - business logic

import { prisma } from '@db/prisma';
import type { AccountPermissions } from '@shared/types';
import { LEADER_PERMISSIONS, DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import { normalizeAccountPermissions } from '@shared/utils';
import { DEFAULT_ASSIGNMENTS, DEFAULT_GAME_PLAN_NOTES, ERROR } from '@shared/constants';
import { getPlayerWithTeam } from '@services/player.service';
import { teamDiscordStatus } from '@services/team-discord.service';
import type { TeamDiscordStatus } from '@shared/types';

// ============================================
// Types
// ============================================
export interface TeamCreateData {
  name: string;
  venueId?: string | null;
  leaderId: string;
}

export interface TeamUpdateData {
  name?: string;
  venueId?: string | null;
  favoriteVenueIds?: string[]; // Distinct, bounded by the caller; replaces the whole list
}

// What identifies a team's logo without loading its bytes
type TeamLogoRef = { id: string; logoType: string | null; logoUpdatedAt: Date | null };

/**
 * Where the client loads a team's logo from. The URL carries the upload time,
 * so a new logo gets a new URL and browsers never show a stale cached one.
 */
export function logoUrlOf(team: TeamLogoRef): string | null {
  if (!team.logoType || !team.logoUpdatedAt) return null;
  return `/api/teams/${team.id}/logo?v=${team.logoUpdatedAt.getTime()}`;
}

export interface MemberWithRole {
  id: string;
  name: string;
  permissions: unknown;
  isLeader: boolean;
}

// Re-export player helpers for convenience
export { getPlayerWithTeam, getPlayerTeam } from '@services/player.service';

// ============================================
// Member-facing team view
// ============================================

export interface TeamView {
  id: string;
  name: string;
  logoUrl: string | null;
  venueId: string | null;
  favoriteVenueIds: string[];
  leaderId: string;
  createdAt: Date;
  updatedAt: Date;
  leader: { id: string; name: string } | null;
  members: MemberWithRole[];
  isLeader: boolean;
  discord: TeamDiscordStatus; // Whether its notifications go to a Discord channel; never the webhook itself
}

/**
 * Team payload for the team page of one of its members.
 * Leader and members are identified by their User id — that is what the client
 * session holds — while the database relations are keyed by Player id.
 */
export async function getTeamViewForPlayer(playerId: string): Promise<TeamView | null> {
  const playerData = await getPlayerWithTeam(playerId);
  const team = playerData?.team;

  if (!team) return null;

  const leaderUser = team.leader?.user ?? null;

  return {
    id: team.id,
    name: team.name,
    logoUrl: logoUrlOf(team),
    venueId: team.venueId,
    favoriteVenueIds: team.favoriteVenues.map(favorite => favorite.venueId),
    leaderId: team.leaderId,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    leader: leaderUser
      ? { id: leaderUser.id, name: leaderUser.name }
      : null,
    members: team.members
      .filter(member => member.user !== null)
      .map(member => ({
        id: member.user!.id,
        name: member.user!.name,
        permissions: member.permissions,
        isLeader: member.id === team.leaderId,
      })),
    isLeader: !!playerData!.ledTeam,
    discord: await teamDiscordStatus(team.id),
  };
}

// ============================================
// Admin view (read-only)
// ============================================

export interface TeamAdminMember {
  id: string;
  playerId: string;
  name: string;
  isLeader: boolean;
}

export interface TeamAdminSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  venue: { id: string; name: string; city: string } | null;
  leader: { id: string; name: string } | null;
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
        include: { user: { select: { id: true, name: true } } },
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return teams.map(t => ({
    id: t.id,
    name: t.name,
    logoUrl: logoUrlOf(t),
    venue: t.venue,
    leader: t.leader?.user
      ? { id: t.leader.user.id, name: t.leader.user.name }
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
        include: { user: { select: { id: true, name: true } } },
      },
      members: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!team) return null;

  const members: TeamAdminMember[] = team.members
    .filter(p => p.user !== null)
    .map(p => ({
      id: p.user!.id,
      playerId: p.id,
      name: p.user!.name,
      isLeader: p.id === team.leaderId,
    }));

  return {
    id: team.id,
    name: team.name,
    logoUrl: logoUrlOf(team),
    venue: team.venue,
    leader: team.leader?.user
      ? { id: team.leader.user.id, name: team.leader.user.name }
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
 * Update team info. The favorite venues, when given, replace the current list
 * in the order received.
 */
export async function updateTeam(teamId: string, data: TeamUpdateData) {
  // Every venue named has to exist
  const venueIds = [...(data.venueId ? [data.venueId] : []), ...(data.favoriteVenueIds ?? [])];
  if (venueIds.length) {
    const known = await prisma.venue.count({ where: { id: { in: venueIds } } });
    if (known !== new Set(venueIds).size) {
      return { error: ERROR.venueNotFound };
    }
  }

  const favoriteVenueIds = data.favoriteVenueIds;
  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.venueId !== undefined && { venueId: data.venueId }),
      ...(favoriteVenueIds && {
        favoriteVenues: {
          deleteMany: {},
          create: favoriteVenueIds.map((venueId, position) => ({ venueId, position })),
        },
      }),
    },
    include: { favoriteVenues: { select: { venueId: true }, orderBy: { position: 'asc' } } },
  });

  const { favoriteVenues, ...rest } = team;
  return { team: { ...rest, favoriteVenueIds: favoriteVenues.map(favorite => favorite.venueId) } };
}

// ============================================
// Logo
// ============================================

export interface TeamLogo {
  data: Buffer;
  type: string;
}

/**
 * The logo image of a team, null when it has none (or no such team)
 */
export async function getTeamLogo(teamId: string): Promise<TeamLogo | null> {
  // The bytes are omitted from every team query by default; this is the one place that wants them
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { logoData: true, logoType: true },
  });
  if (!team?.logoData || !team.logoType) return null;
  return { data: Buffer.from(team.logoData), type: team.logoType };
}

/**
 * Replace the logo of a team with an image already checked by the caller
 */
export async function setTeamLogo(teamId: string, logo: TeamLogo): Promise<string> {
  const team = await prisma.team.update({
    where: { id: teamId },
    // A fresh copy makes the bytes a plain Uint8Array, which is what Prisma stores
    data: { logoData: new Uint8Array(logo.data), logoType: logo.type, logoUpdatedAt: new Date() },
    select: { id: true, logoType: true, logoUpdatedAt: true },
  });
  return logoUrlOf(team)!;
}

/**
 * Remove the logo of a team
 */
export async function clearTeamLogo(teamId: string): Promise<void> {
  await prisma.team.update({
    where: { id: teamId },
    data: { logoData: null, logoType: null, logoUpdatedAt: null },
  });
}

/**
 * Get team members with roles
 */
export async function getTeamMembers(teamId: string): Promise<MemberWithRole[]> {
  const players = await prisma.player.findMany({
    where: { teamId },
    include: {
      user: { select: { id: true, name: true } },
      ledTeam: { select: { id: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return players.map(player => ({
    id: player.user!.id,
    name: player.user!.name,
    permissions: player.ledTeam ? LEADER_PERMISSIONS : normalizeAccountPermissions(player.permissions),
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

  // Only the permissions the app knows, each granted or not
  await prisma.player.update({
    where: { id: targetUser.player.id },
    data: { permissions: normalizeAccountPermissions(permissions) as unknown as object },
  });

  return { success: true };
}

/**
 * Hand the team over to another of its members, who leads it from now on. The
 * former leader stays a member with every permission a leader has, which the
 * new leader adjusts as they see fit. Two hand-overs at once: one wins.
 */
export async function transferLeadership(
  currentUserId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { player: { select: { id: true, ledTeam: { select: { id: true } } } } },
  });

  const team = currentUser?.player.ledTeam;
  if (!team) {
    return { success: false, error: ERROR.onlyLeaderCanTransfer };
  }

  if (memberId === currentUserId) {
    return { success: false, error: ERROR.memberAlreadyLeader };
  }

  const target = await prisma.user.findUnique({
    where: { id: memberId },
    select: { player: { select: { id: true, teamId: true } } },
  });

  if (!target || target.player.teamId !== team.id) {
    return { success: false, error: ERROR.memberNotFound };
  }

  const handedOver = await prisma.$transaction(async tx => {
    const { count } = await tx.team.updateMany({
      where: { id: team.id, leaderId: currentUser!.player.id },
      data: { leaderId: target.player.id },
    });
    if (count === 0) return false;
    await tx.player.update({
      where: { id: currentUser!.player.id },
      data: { permissions: LEADER_PERMISSIONS as unknown as object },
    });
    return true;
  });

  return handedOver ? { success: true } : { success: false, error: ERROR.onlyLeaderCanTransfer };
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
 * Free every player of the team (membership + permissions) and drop the team.
 * The leader is covered even if the leader relation ever drifts from the member
 * list. Game plans, calendar events, invites and balance rules go away with the
 * team through their cascading foreign keys (see prisma/schema.prisma).
 */
async function purgeTeam(teamId: string, leaderId: string): Promise<void> {
  await prisma.$transaction([
    prisma.player.updateMany({
      where: { OR: [{ teamId }, { id: leaderId }] },
      data: {
        teamId: null,
        permissions: DEFAULT_PLAYER_PERMISSIONS as unknown as object,
      },
    }),
    prisma.team.delete({ where: { id: teamId } }),
  ]);
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

  await purgeTeam(player.team.id, player.team.leaderId);

  return { success: true };
}

/**
 * Delete a team by id, regardless of who leads it (admin action).
 * Returns false when no such team exists.
 */
export async function deleteTeamById(teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, leaderId: true },
  });

  if (!team) return false;

  await purgeTeam(team.id, team.leaderId);

  return true;
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
