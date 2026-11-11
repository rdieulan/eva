// Team service - business logic

import { prisma } from '@db/prisma';
import { isUniqueViolation } from '@db/prisma-errors';
import type { AccountPermissions, LeagueTeamSummary } from '@shared/types';
import { LEADER_PERMISSIONS, DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import { normalizeAccountPermissions } from '@shared/utils';
import { DEFAULT_ASSIGNMENTS, DEFAULT_GAME_PLAN_NOTES, ERROR } from '@shared/constants';
import { getPlayerWithTeam } from '@services/player.service';
import { discordChannelStatus } from '@services/discord-channel.service';
import { getLeagueTeamSummary, proposeLeagueTeamVenue, readLeagueLogoForTeam } from '@services/league-directory.service';
import type { LeagueTeamLogo } from '../integrations/competitive/competitive-teams';
import type { DiscordChannelStatus } from '@shared/types';

// ============================================
// Types
// ============================================
export interface TeamCreateData {
  name: string;
  venueId?: string | null;
  leagueTeamId?: string | null; // The league team of the directory it is made from
  leaderId: string;
}

export interface TeamUpdateData {
  name?: string;
  venueId?: string | null;
  favoriteVenueIds?: string[]; // Distinct, bounded by the caller; replaces the whole list
  availabilityHorizonDays?: number; // Within the bounds, checked by the caller
}

/** A team's information as saved, back to whoever saved it: never its logo's bytes nor its Discord webhook */
export interface TeamInformation {
  id: string;
  name: string;
  venueId: string | null;
  favoriteVenueIds: string[];
  availabilityHorizonDays: number;
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
  discord: DiscordChannelStatus; // Whether its notifications go to a Discord channel; never the webhook itself
  leagueTeam: LeagueTeamSummary | null; // The league team it is on competitive.eva.gg, when linked
  availabilityHorizonDays: number; // How many days ahead its players are asked for their availability
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
    discord: await discordChannelStatus('team', team.id),
    leagueTeam: team.leagueTeamId ? await getLeagueTeamSummary(team.leagueTeamId) : null,
    availabilityHorizonDays: team.availabilityHorizonDays,
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

/** A team just created, as its creator's app takes it */
export interface CreatedTeam {
  id: string;
  name: string;
  logoUrl: string | null;
  venueId: string | null;
  favoriteVenueIds: string[];
  leaderId: string;
  createdAt: Date;
  updatedAt: Date;
  availabilityHorizonDays: number;
  isLeader: true;
  // Created from a league team with a logo: whether its logo came along. Null
  // when there was none to take.
  logoCopied: boolean | null;
}

// The creator was given a team by another way while this one was made
class JoinedMeanwhile extends Error {}

/**
 * Create a team, its creator its leader with every permission, and its default
 * game plans. Created from a league team of the directory, it is linked to it
 * and takes its name as given and its logo when the site gives it; a venue,
 * when given, is the one it plays at.
 */
export async function createTeam(data: TeamCreateData): Promise<{ error: string } | { team: CreatedTeam }> {
  const user = await prisma.user.findUnique({
    where: { id: data.leaderId },
    select: { player: { select: { id: true, teamId: true } } },
  });
  if (!user?.player) return { error: ERROR.userNotFound };
  if (user.player.teamId) return { error: ERROR.userAlreadyInTeam };
  const playerId = user.player.id;

  if (data.venueId && !(await prisma.venue.findUnique({ where: { id: data.venueId }, select: { id: true } }))) {
    return { error: ERROR.venueNotFound };
  }

  let logo: LeagueTeamLogo | null = null;
  let hasLeagueLogo = false;
  if (data.leagueTeamId) {
    const leagueTeam = await prisma.leagueTeam.findUnique({
      where: { id: data.leagueTeamId },
      select: { logoId: true, team: { select: { id: true } } },
    });
    if (!leagueTeam) return { error: ERROR.leagueTeamNotFound };
    if (leagueTeam.team) return { error: ERROR.leagueTeamTaken };
    hasLeagueLogo = leagueTeam.logoId !== null;
    logo = await readLeagueLogoForTeam(data.leagueTeamId);
  }

  const maps = await prisma.map.findMany({ select: { id: true } });
  try {
    const team = await prisma.$transaction(async tx => {
      const created = await tx.team.create({
        data: {
          name: data.name.trim(),
          leader: { connect: { id: playerId } },
          ...(data.venueId && { venue: { connect: { id: data.venueId } } }),
          ...(data.leagueTeamId && { leagueTeam: { connect: { id: data.leagueTeamId } } }),
          ...(logo && { logoData: new Uint8Array(logo.data), logoType: logo.type, logoUpdatedAt: new Date() }),
        },
      });
      // The creator joins it, unless another way gave them a team meanwhile
      const joined = await tx.player.updateMany({
        where: { id: playerId, teamId: null },
        data: { teamId: created.id, permissions: LEADER_PERMISSIONS as unknown as object },
      });
      if (joined.count === 0) throw new JoinedMeanwhile();
      // A request to join a team, waiting, is answered by making one
      await tx.teamJoinRequest.deleteMany({ where: { playerId, status: 'PENDING' } });
      await tx.gamePlan.createMany({
        data: maps.map(map => ({
          name: 'Default',
          mapId: map.id,
          teamId: created.id,
          assignments: DEFAULT_ASSIGNMENTS as unknown as object[],
          notes: DEFAULT_GAME_PLAN_NOTES as unknown as object,
        })),
      });
      return created;
    });

    return {
      team: {
        id: team.id,
        name: team.name,
        logoUrl: logoUrlOf(team),
        venueId: team.venueId,
        favoriteVenueIds: [],
        leaderId: team.leaderId,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        availabilityHorizonDays: team.availabilityHorizonDays,
        isLeader: true,
        logoCopied: hasLeagueLogo ? logo !== null : null,
      },
    };
  } catch (error) {
    if (error instanceof JoinedMeanwhile) return { error: ERROR.userAlreadyInTeam };
    // Another player made a team from the same league team meanwhile
    if (isUniqueViolation(error)) return { error: ERROR.leagueTeamTaken };
    throw error;
  }
}

// A team's logo and venue, as the answer of a change that may give it them
const TEAM_LINKED_REF = { id: true, logoType: true, logoUpdatedAt: true, venueId: true } as const;

/** A team just linked or unlinked: its league team, where its logo loads from, its venue */
export interface TeamLeagueLink {
  leagueTeam: TeamView['leagueTeam'];
  logoUrl: string | null;
  venueId: string | null;
}

/**
 * Link a team to its league team of the directory, or unlink it (null). A team
 * with no logo of its own takes the league team's, when the site gives it, and
 * a team with no venue the venue of its local league, when the site tells it.
 * What was read of the league registrations goes with the link: it was the
 * former league team's, not the one the team is now.
 */
export async function setTeamLeagueTeam(teamId: string, leagueTeamId: string | null): Promise<{ error: string } | TeamLeagueLink> {
  if (leagueTeamId === null) {
    const [, updated] = await prisma.$transaction([
      prisma.leagueEntry.deleteMany({ where: { teamId } }),
      prisma.team.update({ where: { id: teamId }, data: { leagueTeamId: null }, select: TEAM_LINKED_REF }),
    ]);
    return { leagueTeam: null, logoUrl: logoUrlOf(updated), venueId: updated.venueId };
  }

  const [team, leagueTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { leagueTeamId: true, logoType: true, venueId: true } }),
    prisma.leagueTeam.findUnique({ where: { id: leagueTeamId }, select: { team: { select: { id: true } } } }),
  ]);
  if (!team) return { error: ERROR.teamNotFound };
  if (!leagueTeam) return { error: ERROR.leagueTeamNotFound };
  if (leagueTeam.team && leagueTeam.team.id !== teamId) return { error: ERROR.leagueTeamTaken };

  const [logo, venue] = await Promise.all([
    team.logoType ? null : readLeagueLogoForTeam(leagueTeamId),
    team.venueId ? null : proposeLeagueTeamVenue(leagueTeamId),
  ]);
  let updated: { id: string; logoType: string | null; logoUpdatedAt: Date | null; venueId: string | null };
  try {
    updated = await prisma.$transaction(async tx => {
      if (team.leagueTeamId !== leagueTeamId) await tx.leagueEntry.deleteMany({ where: { teamId } });
      return tx.team.update({
        where: { id: teamId },
        data: {
          leagueTeamId,
          ...(logo && { logoData: new Uint8Array(logo.data), logoType: logo.type, logoUpdatedAt: new Date() }),
          ...(venue && { venueId: venue.venueId }),
        },
        select: TEAM_LINKED_REF,
      });
    });
  } catch (error) {
    // Another team linked itself to the same league team meanwhile
    if (isUniqueViolation(error)) return { error: ERROR.leagueTeamTaken };
    throw error;
  }
  return { leagueTeam: await getLeagueTeamSummary(leagueTeamId), logoUrl: logoUrlOf(updated), venueId: updated.venueId };
}

/**
 * Update team info. The favorite venues, when given, replace the current list
 * in the order received.
 */
export async function updateTeam(teamId: string, data: TeamUpdateData): Promise<{ error: string; team?: undefined } | { error?: undefined; team: TeamInformation }> {
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
      ...(data.availabilityHorizonDays !== undefined && { availabilityHorizonDays: data.availabilityHorizonDays }),
      ...(favoriteVenueIds && {
        favoriteVenues: {
          deleteMany: {},
          create: favoriteVenueIds.map((venueId, position) => ({ venueId, position })),
        },
      }),
    },
    select: {
      id: true,
      name: true,
      venueId: true,
      availabilityHorizonDays: true,
      favoriteVenues: { select: { venueId: true }, orderBy: { position: 'asc' } },
    },
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
