// eva.gg account service - link a player to their eva.gg account

import { Prisma } from '@prisma/client';
import { prisma } from '@db/prisma';
import type { EvaAccountLink } from '@shared/types';
import { fetchPublicPlayerByUsername, type PublicPlayerMiss } from '../integrations/eva/eva-players';

const EVA_ACCOUNT_SELECT = { evaUserId: true, evaUsername: true, evaLinkedAt: true } as const;

// Prisma's code for a unique constraint violation
const UNIQUE_VIOLATION = 'P2002';

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      return { refusal: 'alreadyLinked' };
    }
    throw error;
  }
}

/**
 * Forget the eva.gg account a player linked
 */
export async function unlinkEvaAccount(playerId: string): Promise<void> {
  await prisma.player.update({
    where: { id: playerId },
    data: { evaUserId: null, evaUsername: null, evaLinkedAt: null },
  });
}
