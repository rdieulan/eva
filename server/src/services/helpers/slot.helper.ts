// Slots a match can be played on

import type { VenueSlot } from '@shared/types';
import { COMPETITIVE_GAME_ID } from '@shared/constants';

export type SlotPlayability = 'playable' | 'otherGame' | 'notCompetitive' | 'taken' | 'passQuotaReached';

/**
 * Whether a slot can host a match: the competitive game, its competitive mode
 * open, nobody in yet, and, at peak hours, the venue still opening sessions to
 * EVA Pass holders that day: the players pay in tokens. Says which fails first.
 */
export function slotPlayability(slot: VenueSlot): SlotPlayability {
  if (slot.gameId !== COMPETITIVE_GAME_ID) return 'otherGame';
  if (!slot.isCompetitiveAvailable) return 'notCompetitive';
  if (slot.takenSeats > 0) return 'taken';
  if (slot.passQuotaLeft === 0) return 'passQuotaReached';
  return 'playable';
}
