// Scrim searches - a team puts a run of a venue's slots up for an opponent

import { prisma } from '@db/prisma';
import type { ScrimSearch, ScrimSearchStatus, VenueSlot } from '@shared/types';
import { logoUrlOf } from '@services/teams.service';
import { getVenueSlots } from '@services/venue-slots.service';
import { formatDateStr, parseMonthRange } from './helpers/date.helper';

// The team behind a search, as loaded with it
const SEARCH_TEAM_INCLUDE = {
  team: { select: { id: true, name: true, logoType: true, logoUpdatedAt: true } },
} as const;

type SearchRow = {
  id: string;
  teamId: string;
  venueId: string;
  date: Date;
  arenaNumber: number;
  evaSlotIds: string[];
  startTime: string;
  endTime: string;
  convocationTime: string;
  status: ScrimSearchStatus;
  createdAt: Date;
  team: { id: string; name: string; logoType: string | null; logoUpdatedAt: Date | null };
};

function toScrimSearch(row: SearchRow, readerTeamId: string): ScrimSearch {
  return {
    id: row.id,
    team: { id: row.team.id, name: row.team.name, logoUrl: logoUrlOf(row.team) },
    venueId: row.venueId,
    date: formatDateStr(row.date),
    arenaNumber: row.arenaNumber,
    evaSlotIds: row.evaSlotIds,
    startTime: row.startTime,
    endTime: row.endTime,
    convocationTime: row.convocationTime,
    status: row.status,
    isMine: row.teamId === readerTeamId,
    createdAt: row.createdAt.toISOString(),
  };
}

// ============================================
// Listing
// ============================================

/**
 * The open searches of a month: every team's at a venue when one is given,
 * the reader's team's everywhere otherwise.
 */
export async function listScrimSearches(input: {
  month: string;
  venueId?: string;
  teamId: string;
}): Promise<ScrimSearch[]> {
  const { startDate, endDate } = parseMonthRange(input.month);

  const rows = await prisma.scrimSearch.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'OPEN',
      ...(input.venueId ? { venueId: input.venueId } : { teamId: input.teamId }),
    },
    include: SEARCH_TEAM_INCLUDE,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { arenaNumber: 'asc' }],
  });

  return rows.map(row => toScrimSearch(row, input.teamId));
}

// ============================================
// Opening a search
// ============================================

export type CreateScrimSearchRefusal =
  | 'venueNotFound'
  | 'venueNotOnEva'
  | 'dateInPast'
  | 'slotsUnknown'        // A slot id eva.gg does not list at that venue on that day
  | 'slotsNotConsecutive' // Not one run on one arena
  | 'slotsNotCompetitive' // A slot does not run the competitive mode
  | 'slotsNotFree'        // Someone is already booked on a slot
  | 'alreadySearching';   // The team already has an open search on one of the slots

export type CreateScrimSearchResult = { search: ScrimSearch } | { refusal: CreateScrimSearchRefusal };

/**
 * Check that the slots form one run on one arena: sorted by start, each one
 * starts when the previous ends. Returns them in that order.
 */
function orderAsRun(slots: VenueSlot[]): VenueSlot[] | null {
  const ordered = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (current.arenaNumber !== previous.arenaNumber || current.startTime !== previous.endTime) return null;
  }
  return ordered;
}

/**
 * Open a search on a run of slots. The slots are read from eva.gg for the
 * venue and the day, so the search carries their real times and arena, and a
 * slot that is not free for a match is refused. Expects distinct slot ids,
 * one at least, bounded by the caller.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
export async function createScrimSearch(input: {
  teamId: string;
  createdById: string;
  venueId: string;
  date: string;
  evaSlotIds: string[];
}): Promise<CreateScrimSearchResult> {
  if (input.date < formatDateStr(new Date())) return { refusal: 'dateInPast' };

  const daySlots = await getVenueSlots(input.venueId, input.date);
  if ('refusal' in daySlots) return { refusal: daySlots.refusal };

  const picked: VenueSlot[] = [];
  for (const slotId of input.evaSlotIds) {
    const slot = daySlots.slots.find(candidate => candidate.slotId === slotId);
    if (!slot) return { refusal: 'slotsUnknown' };
    picked.push(slot);
  }

  const run = orderAsRun(picked);
  if (!run) return { refusal: 'slotsNotConsecutive' };
  if (run.some(slot => !slot.isCompetitiveAvailable)) return { refusal: 'slotsNotCompetitive' };
  if (run.some(slot => slot.takenSeats > 0)) return { refusal: 'slotsNotFree' };

  const overlapping = await prisma.scrimSearch.findFirst({
    where: { teamId: input.teamId, status: 'OPEN', evaSlotIds: { hasSome: input.evaSlotIds } },
    select: { id: true },
  });
  if (overlapping) return { refusal: 'alreadySearching' };

  const first = run[0];
  const last = run[run.length - 1];
  const row = await prisma.scrimSearch.create({
    data: {
      teamId: input.teamId,
      venueId: input.venueId,
      date: new Date(input.date),
      arenaNumber: first.arenaNumber,
      evaSlotIds: run.map(slot => slot.slotId),
      startTime: first.startTime,
      endTime: last.endTime,
      convocationTime: first.convocationTime,
      createdById: input.createdById,
    },
    include: SEARCH_TEAM_INCLUDE,
  });

  return { search: toScrimSearch(row, input.teamId) };
}

// ============================================
// Withdrawing a search
// ============================================

export type DeleteScrimSearchRefusal = 'notFound' | 'notYours' | 'notOpen';

/**
 * Withdraw an open search of the team. A search that already found an
 * opponent stays: the match it produced is the thing to cancel then.
 */
export async function deleteScrimSearch(id: string, teamId: string): Promise<{ refusal?: DeleteScrimSearchRefusal }> {
  const search = await prisma.scrimSearch.findUnique({
    where: { id },
    select: { teamId: true, status: true },
  });
  if (!search) return { refusal: 'notFound' };
  if (search.teamId !== teamId) return { refusal: 'notYours' };
  if (search.status !== 'OPEN') return { refusal: 'notOpen' };

  await prisma.scrimSearch.delete({ where: { id } });
  return {};
}
