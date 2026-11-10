// eva.gg account service - link a player to their eva.gg account: every player
// has one, changed at will, freed only by an administrator

import { prisma } from '@db/prisma';
import { isUniqueViolation } from '@db/prisma-errors';
import type { EvaAccountLink } from '@shared/types';
import { fetchPublicPlayerByUsername, type PublicPlayerMiss } from '../integrations/eva/eva-players';

const EVA_ACCOUNT_SELECT = { evaUserId: true, evaUsername: true, evaLinkedAt: true } as const;

// Why a link was refused: the lookup misses, or another player already holds that account
export type LinkEvaAccountRefusal = PublicPlayerMiss | 'alreadyLinked';

export type LinkEvaAccountResult = { link: EvaAccountLink } | { refusal: LinkEvaAccountRefusal };

function toEvaAccountLink(row: {
  evaUserId: number | null;
  evaUsername: string | null;
  evaLinkedAt: Date | null;
}): EvaAccountLink | null {
  // The three columns are written together, so one of them says it all
  if (row.evaUserId === null || row.evaUsername === null || row.evaLinkedAt === null) return null;
  return {
    userId: row.evaUserId,
    username: row.evaUsername,
    linkedAt: row.evaLinkedAt.toISOString(),
  };
}

/**
 * The eva.gg account a player linked, null when they linked none (or no such player)
 */
export async function getEvaAccountLink(playerId: string): Promise<EvaAccountLink | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: EVA_ACCOUNT_SELECT,
  });
  return player ? toEvaAccountLink(player) : null;
}

/**
 * Resolve an eva.gg tag to its account and link it to the player, replacing any
 * previous link. Expects a trimmed, non-empty tag.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
export async function linkEvaAccount(playerId: string, username: string): Promise<LinkEvaAccountResult> {
  const lookup = await fetchPublicPlayerByUsername(username);
  if ('miss' in lookup) return { refusal: lookup.miss };

  const holder = await prisma.player.findUnique({
    where: { evaUserId: lookup.player.userId },
    select: { id: true },
  });
  if (holder && holder.id !== playerId) return { refusal: 'alreadyLinked' };

  // The unique index still guards against two players linking the same account at once
  try {
    const player = await prisma.player.update({
      where: { id: playerId },
      data: {
        evaUserId: lookup.player.userId,
        // The tag as eva.gg spells it, not as the player typed it
        evaUsername: lookup.player.username,
        evaLinkedAt: new Date(),
      },
      select: EVA_ACCOUNT_SELECT,
    });
    return { link: toEvaAccountLink(player)! };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { refusal: 'alreadyLinked' };
    }
    throw error;
  }
}

/**
 * Free the eva.gg account a player linked, as an administrator does: when a
 * player holds a tag that is not theirs, its owner can then link it. A player
 * never unlinks their own: the one freed is asked for one again at their next
 * visit. False when the player has none linked, or does not exist.
 */
export async function freeEvaAccount(playerId: string): Promise<boolean> {
  const { count } = await prisma.player.updateMany({
    where: { id: playerId, evaUserId: { not: null } },
    data: { evaUserId: null, evaUsername: null, evaLinkedAt: null },
  });
  return count > 0;
}
