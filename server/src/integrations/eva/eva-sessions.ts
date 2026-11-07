// Sessions a venue runs on a given day, as eva.gg lists them
//
// eva.gg publishes no weekly grid: the slots of a venue are listed per date,
// by the same query their booking calendar uses. A slot is one arena for one
// start time. eva.gg lists it once per game it can be booked for (three games
// at Nîmes), and the first booking decides which game the arena runs: we fold
// those sessions back into one slot, held by the game that has players in it,
// or by ours when nobody has booked yet.

import type { SlotTokenType } from '@shared/types';
import { evaGraphql } from './eva-graphql';
import { COMPETITIVE_GAME_ID } from './eva-games';
import { addMinutesToTime } from '../../../../shared/utils/time.utils';

// Narrowed from the useSessions query of app.eva.gg to what we read
const LIST_SESSIONS_QUERY = `
  query useSessions($data: ListLocationSessionsByDateInput!) {
    listLocationGameSessionsByDate(data: $data) {
      takenSeatCount
      totalSeatCount
      slot {
        id
        startTime
        convocationTime
        duration
      }
      terrain {
        displayNumber
      }
      game {
        id
      }
      competitiveMode {
        isAvailable
      }
      pricingType
      subscriptionPricingType
      subscriptionThreshold {
        mustDeduct
        countLeftDaily
      }
    }
  }
`;

interface EvaSessionData {
  takenSeatCount: number;
  totalSeatCount: number;
  slot: { id: string; startTime: string; convocationTime: string; duration: number };
  terrain: { displayNumber: number | string };
  game: { id: number | string } | null;
  competitiveMode: { isAvailable: boolean } | null;
  pricingType: string | null;             // PEAK_HOUR, OFF_PEAK_HOUR, GOOD_DEAL_HOUR or NORMAL
  subscriptionPricingType: string | null; // The same, as rated for an EVA Pass holder
  // The day's pass quota of the venue, the same on every session of the day:
  // how many peak sessions it still opens to pass holders, and whether this
  // session counts against it. Read without an account.
  subscriptionThreshold: { mustDeduct: boolean; countLeftDaily: number } | null;
}

export interface EvaSession {
  slotId: string;          // One arena at one hour: eva.gg's slot id, followed by the arena (see arenaSlotId)
  startTime: string;       // HH:mm, when play starts
  endTime: string;         // HH:mm, start plus the slot duration
  convocationTime: string; // HH:mm, when eva.gg expects the players; what their app shows
  arenaNumber: number;
  gameId: number;          // The game holding the arena at that time: ours while nobody booked (see COMPETITIVE_GAME_ID)
  takenSeats: number;      // Players booked on the game holding the slot
  totalSeats: number; // Capacity of the slot as eva.gg opened it (10, or 8 in some modes)
  isCompetitiveAvailable: boolean;
  tokenType: SlotTokenType | null; // What a pass holder spends on it
  passQuotaLeft: number | null;    // The venue's peak sessions left to pass holders that day, when this one counts against them
}

/**
 * The token an EVA Pass holder spends on a session. eva.gg rates it for a
 * pass holder, falling back on the visitor's rate like their app does: peak
 * hours take a peak token; off-peak hours and good deals an off-peak one,
 * their app showing a good deal as off-peak to a pass holder. Their NORMAL
 * rate is an hour of neither kind.
 */
function tokenTypeOf(session: EvaSessionData): SlotTokenType | null {
  const rate = session.subscriptionPricingType ?? session.pricingType;
  if (rate === 'PEAK_HOUR') return 'peak';
  if (rate === 'OFF_PEAK_HOUR' || rate === 'GOOD_DEAL_HOUR') return 'offPeak';
  return null;
}

/**
 * Our id of a slot. eva.gg's slot id names an hour of the venue, the same on
 * each of its arenas at that hour, while a match takes one arena: the arena
 * follows the id, so the arenas of a venue never share a slot.
 */
export function arenaSlotId(evaSlotId: string, arenaNumber: number): string {
  return `${evaSlotId}-${arenaNumber}`;
}

function toSession(session: EvaSessionData): EvaSession {
  const arenaNumber = Number(session.terrain.displayNumber);
  return {
    slotId: arenaSlotId(session.slot.id, arenaNumber),
    startTime: session.slot.startTime,
    endTime: addMinutesToTime(session.slot.startTime, session.slot.duration),
    convocationTime: session.slot.convocationTime,
    arenaNumber,
    gameId: Number(session.game?.id ?? 0),
    takenSeats: session.takenSeatCount,
    totalSeats: session.totalSeatCount,
    isCompetitiveAvailable: session.competitiveMode?.isAvailable ?? false,
    tokenType: tokenTypeOf(session),
    passQuotaLeft: session.subscriptionThreshold?.mustDeduct ? session.subscriptionThreshold.countLeftDaily : null,
  };
}

/**
 * One slot out of the sessions eva.gg lists for one arena and one start time,
 * one per game: the game with players in holds it; with nobody in, ours does.
 */
function foldGames(sessions: EvaSession[]): EvaSession {
  const booked = sessions.find(session => session.takenSeats > 0);
  if (booked) return booked;
  return sessions.find(session => session.gameId === COMPETITIVE_GAME_ID) ?? sessions[0]!;
}

/**
 * The slots a location runs on a date (YYYY-MM-DD), in start-time order, each
 * held by one game. Empty when the venue is closed that day.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
export async function fetchLocationSessions(locationId: number, date: string): Promise<EvaSession[]> {
  const data = await evaGraphql<{ listLocationGameSessionsByDate: EvaSessionData[] | null }>(LIST_SESSIONS_QUERY, {
    data: {
      date,
      locationId,
      // What their calendar sends for a visitor who picked nothing yet: lists every session of every game
      seatCount: 1,
      seatTypes: ['PLAYER'],
      isCompetitiveModeOnly: false,
    },
  });

  const byArenaAndTime = new Map<string, EvaSession[]>();
  for (const raw of data.listLocationGameSessionsByDate ?? []) {
    const session = toSession(raw);
    const key = `${session.arenaNumber}@${session.startTime}`;
    byArenaAndTime.set(key, [...(byArenaAndTime.get(key) ?? []), session]);
  }

  return [...byArenaAndTime.values()]
    .map(foldGames)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.arenaNumber - b.arenaNumber);
}
