// Requests to join a team: a player without a team asks to join one they found
// through its league team, and its leader or a member who may invite answers.
// A player waits on one request at a time; a refusal stays, so that team is not
// asked again by them, and they see it once. A request taken back stays too:
// each request alerts the team, so it hears from the same player once a day at
// most.

import { prisma } from '@db/prisma';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import type { JoinRequestStatus, MyJoinRequest, TeamJoinRequestView } from '@shared/types';
import { ERROR } from '@shared/constants';
import { logoUrlOf } from '@services/teams.service';
import { notify } from '@services/notification.service';

// What the player's own request shows of the team asked
const MY_REQUEST_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  team: { select: { id: true, name: true, logoType: true, logoUpdatedAt: true } },
} as const;

type MyRequestRow = {
  id: string;
  status: JoinRequestStatus;
  createdAt: Date;
  team: { id: string; name: string; logoType: string | null; logoUpdatedAt: Date | null };
};

function toMyJoinRequest(row: MyRequestRow): MyJoinRequest {
  // Only a request waiting or refused is read for the player
  if (row.status === 'CANCELLED') throw new Error(`Join request ${row.id} was taken back: it is never shown`);
  return {
    id: row.id,
    status: row.status,
    team: { id: row.team.id, name: row.team.name, logoUrl: logoUrlOf(row.team) },
    createdAt: row.createdAt.toISOString(),
  };
}

// A request the rules refuse, said by its message
class Refusal extends Error {}

// The least time between two requests of a player to the same team, the first
// one taken back since: each one alerts the team
export const JOIN_REQUEST_AGAIN_PAUSE_MS = 24 * 60 * 60 * 1000;

/**
 * Ask to join a team. The player has no team, no other request waiting, was
 * never refused by that team, and has not asked it within the pause. Its
 * leader and the members who may invite are told.
 */
export async function requestToJoin(playerId: string, teamId: string): Promise<{ error: string } | { request: MyJoinRequest }> {
  const [player, team] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true, evaUsername: true, user: { select: { name: true } } } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true } }),
  ]);
  if (!player?.user) return { error: ERROR.userNotFound };
  if (player.teamId) return { error: ERROR.userAlreadyInTeam };
  if (!team) return { error: ERROR.teamNotFound };

  let request: MyRequestRow;
  try {
    request = await prisma.$transaction(async tx => {
      // The player's row, locked: two requests sent at once wait for each other
      await tx.$queryRaw`SELECT 1 FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`;
      const previous = await tx.teamJoinRequest.findMany({ where: { playerId }, select: { id: true, teamId: true, status: true, createdAt: true } });
      const sameTeam = previous.find(other => other.teamId === teamId);
      if (sameTeam?.status === 'REFUSED') throw new Refusal(ERROR.joinRequestRefusedBefore);
      if (previous.some(other => other.status === 'PENDING')) throw new Refusal(ERROR.joinRequestAlreadyPending);
      if (sameTeam) {
        // Taken back: the new request replaces it once the pause is over
        if (Date.now() - sameTeam.createdAt.getTime() < JOIN_REQUEST_AGAIN_PAUSE_MS) throw new Refusal(ERROR.joinRequestTooSoon);
        await tx.teamJoinRequest.delete({ where: { id: sameTeam.id } });
      }
      return tx.teamJoinRequest.create({ data: { playerId, teamId }, select: MY_REQUEST_SELECT });
    });
  } catch (error) {
    if (error instanceof Refusal) return { error: error.message };
    throw error;
  }

  await notify(
    { kind: 'TEAM_JOIN_REQUESTED', data: { requestId: request.id, playerName: player.user.name, evaUsername: player.evaUsername } },
    { teamId, permission: { category: 'team', name: 'canInviteMembers' } },
  );
  return { request: toMyJoinRequest(request) };
}

/** The player's request: the one waiting, or else a refusal they have not seen yet */
export async function getMyJoinRequest(playerId: string): Promise<MyJoinRequest | null> {
  const requests = await prisma.teamJoinRequest.findMany({
    where: { playerId, OR: [{ status: 'PENDING' }, { status: 'REFUSED', refusalSeenAt: null }] },
    select: MY_REQUEST_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  const request = requests.find(row => row.status === 'PENDING') ?? requests[0];
  return request ? toMyJoinRequest(request) : null;
}

/**
 * Take back the player's waiting request; false when none was waiting. It
 * leaves the team's list but stays, for when they ask that team again.
 */
export async function cancelMyJoinRequest(playerId: string): Promise<boolean> {
  const { count } = await prisma.teamJoinRequest.updateMany({ where: { playerId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  return count > 0;
}

/** The player saw the refusals of their requests: they are not shown again */
export async function markMyRefusalsSeen(playerId: string): Promise<void> {
  await prisma.teamJoinRequest.updateMany({
    where: { playerId, status: 'REFUSED', refusalSeenAt: null },
    data: { refusalSeenAt: new Date() },
  });
}

/** The requests waiting for a team's answer, oldest first */
export async function listTeamJoinRequests(teamId: string): Promise<TeamJoinRequestView[]> {
  const requests = await prisma.teamJoinRequest.findMany({
    where: { teamId, status: 'PENDING' },
    select: { id: true, createdAt: true, player: { select: { evaUsername: true, user: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  return requests.map(request => ({
    id: request.id,
    playerName: request.player.user?.name ?? '',
    evaUsername: request.player.evaUsername,
    createdAt: request.createdAt.toISOString(),
  }));
}

/**
 * Let the player of a waiting request in: a member with the permissions every
 * new member starts with. A player who got a team another way meanwhile stays
 * there, and the request goes all the same.
 */
export async function acceptJoinRequest(teamId: string, requestId: string): Promise<{ error: string } | { joined: true }> {
  const outcome = await prisma.$transaction(async tx => {
    const request = await tx.teamJoinRequest.findFirst({ where: { id: requestId, teamId, status: 'PENDING' }, select: { playerId: true } });
    if (!request) return ERROR.joinRequestNotFound;
    await tx.teamJoinRequest.delete({ where: { id: requestId } });
    const joined = await tx.player.updateMany({
      where: { id: request.playerId, teamId: null },
      data: { teamId, permissions: DEFAULT_PLAYER_PERMISSIONS as unknown as object },
    });
    return joined.count ? null : ERROR.joinRequestPlayerTaken;
  });
  return outcome ? { error: outcome } : { joined: true };
}

/** Say no to a waiting request: the player sees it once, and cannot ask this team again */
export async function refuseJoinRequest(teamId: string, requestId: string): Promise<boolean> {
  const { count } = await prisma.teamJoinRequest.updateMany({
    where: { id: requestId, teamId, status: 'PENDING' },
    data: { status: 'REFUSED', answeredAt: new Date() },
  });
  return count > 0;
}
