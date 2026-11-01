// Sessions a venue runs on a given day, as eva.gg lists them
//
// eva.gg publishes no weekly grid: the slots of a venue are listed per date,
// by the same query their booking calendar uses. A slot is one arena for one
// start time; a venue with several arenas lists one session per arena.

import { evaGraphql } from './eva-graphql';
import { COMPETITIVE_GAME_ID } from './eva-games';
import { addMinutesToTime } from '../../../../shared/utils/time.utils';

// Narrowed from the useSessions query of app.eva.gg to what we read
const LIST_SESSIONS_QUERY = `
  query useSessions($data: ListLocationSessionsByDateInput!) {
    listLocationGameSessionsByDate(data: $data) {
      availableSeatCount
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
      competitiveMode {
        isAvailable
      }
    }
  }
`;

interface EvaSessionData {
  availableSeatCount: number;
  totalSeatCount: number;
  slot: { id: string; startTime: string; convocationTime: string; duration: number };
  terrain: { displayNumber: number | string };
  competitiveMode: { isAvailable: boolean } | null;
}

export interface EvaSession {
  slotId: string;          // Opaque, stable: bookings carry the same id
  startTime: string;       // HH:mm, when play starts
  endTime: string;         // HH:mm, start plus the slot duration
  convocationTime: string; // HH:mm, when eva.gg expects the players; what their app shows
  arenaNumber: number;
  availableSeats: number;
  totalSeats: number;
  isCompetitiveAvailable: boolean;
}

/**
 * The competitive-game sessions a location runs on a date (YYYY-MM-DD), in
 * start-time order. Empty when the venue is closed that day.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
export async function fetchLocationSessions(locationId: number, date: string): Promise<EvaSession[]> {
  const data = await evaGraphql<{ listLocationGameSessionsByDate: EvaSessionData[] | null }>(LIST_SESSIONS_QUERY, {
    data: {
      date,
      locationId,
      // What their calendar sends for a visitor who picked nothing yet: lists every session
      seatCount: 1,
      seatTypes: ['PLAYER'],
      isCompetitiveModeOnly: false,
      gameIdList: [COMPETITIVE_GAME_ID],
    },
  });

  const sessions = data.listLocationGameSessionsByDate ?? [];

  return sessions
    .map(session => ({
      slotId: session.slot.id,
      startTime: session.slot.startTime,
      endTime: addMinutesToTime(session.slot.startTime, session.slot.duration),
      convocationTime: session.slot.convocationTime,
      arenaNumber: Number(session.terrain.displayNumber),
      availableSeats: session.availableSeatCount,
      totalSeats: session.totalSeatCount,
      isCompetitiveAvailable: session.competitiveMode?.isAvailable ?? false,
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.arenaNumber - b.arenaNumber);
}
