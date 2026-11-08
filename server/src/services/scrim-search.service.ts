// Scrim searches - a team offers slots of one venue or more, for a day, to whoever wants to play against it

import { prisma } from '@db/prisma';
import type {
  ScrimOfferedSlot,
  ScrimProposal,
  ScrimSearch,
  ScrimSearchStatus,
  ScrimVenueOffer,
  VenueSlot,
} from '@shared/types';
import { countMatches, orderRunSlots, runSpan, spansOverlap } from '@shared/utils';
import { logoUrlOf } from '@services/teams.service';
import { getVenueSlots } from '@services/venue-slots.service';
import { PROPOSAL_TEAM_INCLUDE, declineProposals, toScrimProposal, type ProposalRow } from '@services/scrim-proposal.service';
import { formatDateStr, parseMonthRange } from './helpers/date.helper';
import { slotPlayability } from './helpers/slot.helper';
import {
  PROPOSAL_FACTS_SELECT,
  notifyProposalsDeclined,
  notifySearchExpired,
  notifySearchWithdrawn,
  type DeclinedProposal,
  type ProposalFacts,
} from '@services/scrim-notification.service';

// The team behind a search, its offered slots and the proposals it received, as loaded with it
export const SEARCH_INCLUDE = {
  team: { select: { id: true, name: true, logoType: true, logoUpdatedAt: true } },
  slots: { orderBy: { position: 'asc' as const } },
  proposals: { include: PROPOSAL_TEAM_INCLUDE, orderBy: { createdAt: 'asc' as const } },
} as const;

type SlotRow = {
  evaSlotId: string;
  venueId: string;
  arenaNumber: number;
  startTime: string;
  endTime: string;
  convocationTime: string;
};

type SearchRow = {
  id: string;
  teamId: string;
  date: Date;
  slotCount: number;
  matchCount: number;
  startTime: string;
  endTime: string;
  convocationTime: string;
  status: ScrimSearchStatus;
  createdAt: Date;
  team: { id: string; name: string; logoType: string | null; logoUpdatedAt: Date | null };
  slots: SlotRow[];
  proposals: ProposalRow[];
};

/**
 * The proposals a reader may see on a search: every pending one on their own
 * search, only their own team's on another team's search. Who else answered
 * is the searching team's business.
 */
function visibleProposals(row: SearchRow, readerTeamId: string): ScrimProposal[] {
  const visible = row.teamId === readerTeamId
    ? row.proposals.filter(proposal => proposal.status === 'PENDING')
    : row.proposals.filter(proposal => proposal.teamId === readerTeamId);
  return visible.map(proposal => toScrimProposal(proposal, readerTeamId));
}

function toOfferedSlot(row: SlotRow): ScrimOfferedSlot {
  return {
    slotId: row.evaSlotId,
    venueId: row.venueId,
    arenaNumber: row.arenaNumber,
    startTime: row.startTime,
    endTime: row.endTime,
    convocationTime: row.convocationTime,
  };
}

/**
 * The offered slots no other match can take: those at the time of a match
 * already made, wherever it is played, since the team plays one at a time
 */
export function takenSlotIds(slots: SlotRow[], matches: { startTime: string; endTime: string }[]): string[] {
  const busy = matches.map(runSpan);
  return slots
    .filter(slot => busy.some(span => spansOverlap(span, runSpan(slot))))
    .map(slot => slot.evaSlotId);
}

function toScrimSearch(row: SearchRow, readerTeamId: string): ScrimSearch {
  const matched = row.proposals.filter(proposal => proposal.status === 'ACCEPTED');
  return {
    id: row.id,
    team: { id: row.team.id, name: row.team.name, logoUrl: logoUrlOf(row.team) },
    date: formatDateStr(row.date),
    slots: row.slots.map(toOfferedSlot),
    slotCount: row.slotCount,
    matchCount: row.matchCount,
    matchedCount: matched.length,
    takenSlotIds: takenSlotIds(row.slots, matched),
    startTime: row.startTime,
    endTime: row.endTime,
    convocationTime: row.convocationTime,
    status: row.status,
    isMine: row.teamId === readerTeamId,
    proposals: visibleProposals(row, readerTeamId),
    createdAt: row.createdAt.toISOString(),
  };
}

// ============================================
// Listing
// ============================================

/**
 * The open searches of a month: the reader's team's wherever they are, and,
 * when venues are given, every other team's offering slots in one of them. A
 * search comes with all its slots, those of the other venues included.
 */
export async function listScrimSearches(input: {
  month: string;
  venueIds?: string[];
  teamId: string;
}): Promise<ScrimSearch[]> {
  const { startDate, endDate } = parseMonthRange(input.month);

  const rows = await prisma.scrimSearch.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'OPEN',
      ...(input.venueIds
        ? { OR: [{ teamId: input.teamId }, { slots: { some: { venueId: { in: input.venueIds } } } }] }
        : { teamId: input.teamId }),
    },
    include: SEARCH_INCLUDE,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  return rows.map(row => toScrimSearch(row, input.teamId));
}

// ============================================
// Opening a search
// ============================================

// Why an offer read from eva.gg is refused
export type OfferRefusal =
  | 'venueNotFound'
  | 'venueNotOnEva'
  | 'slotsUnknown'        // A slot id eva.gg does not list at that venue on that day
  | 'slotsOtherGame'      // A slot given to another of their games
  | 'slotsNotCompetitive' // A slot whose competitive mode is closed
  | 'slotsNotFree'        // Someone is already booked on a slot
  | 'slotsPassQuota';     // A peak slot the venue no longer opens to EVA Pass holders that day

export type CreateScrimSearchRefusal =
  | OfferRefusal
  | 'dateInPast'
  | 'offerTooShort'       // The offered slots do not hold every match asked for, one at a time
  | 'alreadySearching';   // The team already has an open search that day

export type CreateScrimSearchResult = { search: ScrimSearch } | { refusal: CreateScrimSearchRefusal };

const PLAYABILITY_REFUSALS = {
  otherGame: 'slotsOtherGame',
  notCompetitive: 'slotsNotCompetitive',
  taken: 'slotsNotFree',
  passQuotaReached: 'slotsPassQuota',
} as const;

// An offered slot, read from eva.gg, with the venue it belongs to
type OfferedVenueSlot = VenueSlot & { venueId: string };

/**
 * Read the offered slots from eva.gg, venue by venue in the team's order and
 * each venue's arena by arena, then by time; refuses a slot eva.gg does not
 * list or a match cannot take.
 */
async function readOffer(
  venues: ScrimVenueOffer[],
  date: string,
): Promise<{ slots: OfferedVenueSlot[] } | { refusal: OfferRefusal }> {
  const offered: OfferedVenueSlot[] = [];
  for (const venue of venues) {
    const daySlots = await getVenueSlots(venue.venueId, date);
    if ('refusal' in daySlots) return { refusal: daySlots.refusal };

    const picked: VenueSlot[] = [];
    for (const slotId of venue.evaSlotIds) {
      const slot = daySlots.slots.find(candidate => candidate.slotId === slotId);
      if (!slot) return { refusal: 'slotsUnknown' };
      picked.push(slot);
    }
    for (const slot of picked) {
      const playability = slotPlayability(slot);
      if (playability !== 'playable') return { refusal: PLAYABILITY_REFUSALS[playability] };
    }
    offered.push(...orderRunSlots(picked).map(slot => ({ ...slot, venueId: venue.venueId })));
  }
  return { slots: offered };
}

/**
 * Open a search: the team offers slots of one venue or more for a day, on any
 * arena, not necessarily back to back, and says how many matches it wants on
 * them that day, wherever they are played; an opponent picks the run of a
 * match among them. The offer must hold every match, one at a time. The slots
 * are read from eva.gg so the search carries their real times, and a slot a
 * match cannot take is refused. One open search per team and day. Expects
 * distinct venues, each with distinct slot ids, one at least, bounded by the
 * caller.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
export async function createScrimSearch(input: {
  teamId: string;
  createdById: string;
  date: string;
  venues: ScrimVenueOffer[];
  slotCount: number; // Checked by the caller against SCRIM_MATCH_SLOTS_MIN and MAX
  matchCount: number; // Checked by the caller against SCRIM_MATCH_COUNT_MIN and MAX
}): Promise<CreateScrimSearchResult> {
  if (input.date < formatDateStr(new Date())) return { refusal: 'dateInPast' };

  const day = new Date(input.date);
  const openThatDay = { teamId: input.teamId, date: day, status: 'OPEN' as const };
  // Before asking eva.gg anything; checked again below, where it counts
  if (await prisma.scrimSearch.findFirst({ where: openThatDay, select: { id: true } })) {
    return { refusal: 'alreadySearching' };
  }

  const offer = await readOffer(input.venues, input.date);
  if ('refusal' in offer) return offer;
  const offered = offer.slots;

  if (countMatches(orderRunSlots(offered), input.slotCount) < input.matchCount) return { refusal: 'offerTooShort' };
  const hours = offerHours(offered);

  // Under a lock on the team, so two offers sent together cannot both open the day
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM "Team" WHERE "id" = ${input.teamId} FOR UPDATE`;
    if (await tx.scrimSearch.findFirst({ where: openThatDay, select: { id: true } })) {
      return { refusal: 'alreadySearching' as const };
    }

    const row = await tx.scrimSearch.create({
      data: {
        teamId: input.teamId,
        date: day,
        slotCount: input.slotCount,
        matchCount: input.matchCount,
        ...hours,
        createdById: input.createdById,
        slots: { create: slotRows(offered) },
      },
      include: SEARCH_INCLUDE,
    });

    return { search: toScrimSearch(row, input.teamId) };
  });
}

// When an offer starts, ends, and when eva.gg expects the players for its
// earliest slot
function offerHours(offered: { startTime: string; endTime: string; convocationTime: string }[]): { startTime: string; endTime: string; convocationTime: string } {
  const earliest = [...offered].sort((a, b) => a.startTime.localeCompare(b.startTime))[0]!;
  const latest = [...offered].sort((a, b) => runSpan(b).end - runSpan(a).end)[0]!;
  return { startTime: earliest.startTime, endTime: latest.endTime, convocationTime: earliest.convocationTime };
}

// The rows of an offer's slots, in its order
function slotRows(offered: OfferedVenueSlot[]) {
  return offered.map((slot, position) => ({
    venueId: slot.venueId,
    evaSlotId: slot.slotId,
    arenaNumber: slot.arenaNumber,
    startTime: slot.startTime,
    endTime: slot.endTime,
    convocationTime: slot.convocationTime,
    position,
  }));
}

// ============================================
// Changing a search
// ============================================

export type UpdateScrimSearchRefusal =
  | OfferRefusal
  | 'notFound'
  | 'notYours'
  | 'notOpen'
  | 'dateInPast'
  | 'offerTooShort'     // The offer does not hold the matches still wanted, beside those made
  | 'matchCountTooLow'; // No match more than those already made

export type UpdateScrimSearchResult = { search: ScrimSearch } | { refusal: UpdateScrimSearchRefusal };

/**
 * Change an open search of the team: its slots, in one venue or more, how
 * long a match is and how many the team wants that day; the day stays. The
 * offer is read from eva.gg as when the search opened. The matches already
 * made stay: the search wants one more at least, and the offer must hold the
 * ones still wanted, none at the time of a match made. A pending proposal
 * whose run the offer no longer holds whole, at the length asked, is
 * declined; the others stay. Answers and changes on a search are taken one at
 * a time. Expects distinct venues, each with distinct slot ids, one at least,
 * bounded by the caller.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
export async function updateScrimSearch(input: {
  id: string;
  teamId: string;
  venues: ScrimVenueOffer[];
  slotCount: number; // Checked by the caller against SCRIM_MATCH_SLOTS_MIN and MAX
  matchCount: number; // Checked by the caller against SCRIM_MATCH_COUNT_MIN and MAX
}): Promise<UpdateScrimSearchResult> {
  const current = await prisma.scrimSearch.findUnique({
    where: { id: input.id },
    select: { teamId: true, status: true, date: true },
  });
  if (!current) return { refusal: 'notFound' };
  if (current.teamId !== input.teamId) return { refusal: 'notYours' };
  if (current.status !== 'OPEN') return { refusal: 'notOpen' };
  const date = formatDateStr(current.date);
  if (date < formatDateStr(new Date())) return { refusal: 'dateInPast' };

  const offer = await readOffer(input.venues, date);
  if ('refusal' in offer) return offer;
  const offered = offer.slots;

  const outcome = await prisma.$transaction(async (tx): Promise<{ refusal: UpdateScrimSearchRefusal } | { search: ScrimSearch; lapsed: DeclinedProposal[] }> => {
    await tx.$queryRaw`SELECT 1 FROM "ScrimSearch" WHERE "id" = ${input.id} FOR UPDATE`;
    const search = await tx.scrimSearch.findUnique({
      where: { id: input.id },
      select: {
        status: true,
        proposals: {
          where: { status: { in: ['ACCEPTED', 'PENDING'] } },
          select: { id: true, status: true, venueId: true, evaSlotIds: true, startTime: true, endTime: true },
        },
      },
    });
    if (!search) return { refusal: 'notFound' as const };
    if (search.status !== 'OPEN') return { refusal: 'notOpen' as const };

    const made = search.proposals.filter(proposal => proposal.status === 'ACCEPTED');
    if (input.matchCount <= made.length) return { refusal: 'matchCountTooLow' as const };
    const busy = made.map(runSpan);
    if (countMatches(orderRunSlots(offered), input.slotCount, busy) < input.matchCount - made.length) {
      return { refusal: 'offerTooShort' as const };
    }

    // A pending proposal stays while the offer holds its whole run, in its venue, at the length asked
    const venueOfSlot = new Map(offered.map(slot => [slot.slotId, slot.venueId]));
    const lapsed = search.proposals
      .filter(proposal => proposal.status === 'PENDING' && (
        proposal.evaSlotIds.length !== input.slotCount
        || proposal.evaSlotIds.some(slotId => venueOfSlot.get(slotId) !== proposal.venueId)
      ))
      .map((proposal): DeclinedProposal => ({ id: proposal.id, reason: 'SEARCH_CHANGED' }));
    await declineProposals(tx, lapsed, new Date());

    await tx.scrimSearchSlot.deleteMany({ where: { searchId: input.id } });
    const row = await tx.scrimSearch.update({
      where: { id: input.id },
      data: {
        slotCount: input.slotCount,
        matchCount: input.matchCount,
        ...offerHours(offered),
        slots: { create: slotRows(offered) },
      },
      include: SEARCH_INCLUDE,
    });

    return { search: toScrimSearch(row, input.teamId), lapsed };
  });
  if ('refusal' in outcome) return outcome;

  await notifyProposalsDeclined(outcome.lapsed);
  return { search: outcome.search };
}

// ============================================
// Withdrawing a search
// ============================================

export type DeleteScrimSearchRefusal = 'notFound' | 'notYours' | 'notOpen';

/**
 * Withdraw an open search of the team, with the matches it still looks for:
 * the proposals pending on it fall. A search that made no match yet is
 * deleted. One that made matches closes as matched instead: its matches stay
 * in both calendars, still tied to it, so that either team can call them off.
 * A closed search stays: its matches are the things to cancel then. Taken one
 * at a time with the answers and changes on the search.
 */
export async function deleteScrimSearch(id: string, teamId: string): Promise<{ refusal?: DeleteScrimSearchRefusal }> {
  const outcome = await prisma.$transaction(async (tx): Promise<{ refusal: DeleteScrimSearchRefusal } | { pending: ProposalFacts[] }> => {
    await tx.$queryRaw`SELECT 1 FROM "ScrimSearch" WHERE "id" = ${id} FOR UPDATE`;
    const search = await tx.scrimSearch.findUnique({
      where: { id },
      select: { teamId: true, status: true, _count: { select: { proposals: { where: { status: 'ACCEPTED' } } } } },
    });
    if (!search) return { refusal: 'notFound' as const };
    if (search.teamId !== teamId) return { refusal: 'notYours' as const };
    if (search.status !== 'OPEN') return { refusal: 'notOpen' as const };

    // Read before they go: a search deleted takes its proposals with it
    const pending = await tx.scrimProposal.findMany({ where: { searchId: id, status: 'PENDING' }, select: PROPOSAL_FACTS_SELECT });
    if (!search._count.proposals) {
      await tx.scrimSearch.delete({ where: { id } });
      return { pending };
    }
    await declineProposals(tx, pending.map(proposal => ({ id: proposal.id, reason: 'SEARCH_WITHDRAWN' })), new Date());
    await tx.scrimSearch.update({ where: { id }, data: { status: 'MATCHED' } });
    return { pending };
  });
  if ('refusal' in outcome) return outcome;

  await notifySearchWithdrawn(outcome.pending);
  return {};
}

// ============================================
// Keeping a search in step with eva.gg
// ============================================

export type RefreshedOffer = {
  lost: number;    // Offered slots no longer open to a match, out of the offer
  closed: boolean; // The search no longer holds a match: closed, its pending proposals declined
};

/**
 * Take out of an open search the slots eva.gg no longer opens to a match:
 * booked by someone since, given to another game, closed to the competitive
 * mode, past the venue's pass quota, or gone from the day. `daySlots` gives a
 * venue's slots that day as just read, or null when they could not be: its
 * offered slots are then kept. A slot at the time of a match the search made
 * is left alone: the match's own players hold it. A pending proposal on a slot
 * taken out is declined. A search that no longer holds a match closes, its
 * pending proposals declined: as matched when it made some, as expired
 * otherwise. Taken one at a time with the answers and changes on the search.
 */
export async function refreshSearchOffer(
  searchId: string,
  daySlots: (venueId: string) => VenueSlot[] | null,
): Promise<RefreshedOffer> {
  const outcome = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM "ScrimSearch" WHERE "id" = ${searchId} FOR UPDATE`;
    const search = await tx.scrimSearch.findUnique({
      where: { id: searchId },
      select: {
        teamId: true,
        date: true,
        status: true,
        slotCount: true,
        slots: { select: { id: true, venueId: true, evaSlotId: true, arenaNumber: true, startTime: true, endTime: true, convocationTime: true } },
        proposals: {
          where: { status: { in: ['ACCEPTED', 'PENDING'] } },
          select: { id: true, status: true, evaSlotIds: true, startTime: true, endTime: true },
        },
      },
    });
    if (!search || search.status !== 'OPEN') return { lost: 0, closed: false, declined: [], expired: null };

    const made = search.proposals.filter(proposal => proposal.status === 'ACCEPTED');
    const busy = made.map(runSpan);
    const isBusy = (slot: { startTime: string; endTime: string }) => busy.some(span => spansOverlap(span, runSpan(slot)));

    const lost = search.slots.filter(slot => {
      if (isBusy(slot)) return false;
      const day = daySlots(slot.venueId);
      if (!day) return false;
      const live = day.find(candidate => candidate.slotId === slot.evaSlotId);
      return !live || slotPlayability(live) !== 'playable';
    });
    if (!lost.length) return { lost: 0, closed: false, declined: [], expired: null };

    const lostIds = new Set(lost.map(slot => slot.evaSlotId));
    const remaining = search.slots.filter(slot => !lostIds.has(slot.evaSlotId));
    const free = remaining.filter(slot => !isBusy(slot));
    const closed = countMatches(orderRunSlots(free), search.slotCount, busy) === 0;

    // A proposal on a slot taken out falls for it; the others when the search closes
    const pending = search.proposals.filter(proposal => proposal.status === 'PENDING');
    const declined = pending.flatMap((proposal): DeclinedProposal[] => {
      if (proposal.evaSlotIds.some(slotId => lostIds.has(slotId))) return [{ id: proposal.id, reason: 'RUN_TAKEN' }];
      return closed ? [{ id: proposal.id, reason: 'SEARCH_CLOSED' }] : [];
    });
    await declineProposals(tx, declined, new Date());

    await tx.scrimSearchSlot.deleteMany({ where: { id: { in: lost.map(slot => slot.id) } } });
    await tx.scrimSearch.update({
      where: { id: searchId },
      data: {
        ...(remaining.length ? offerHours(remaining) : {}),
        ...(closed ? { status: made.length ? 'MATCHED' as const : 'EXPIRED' as const } : {}),
      },
    });

    const expired = closed && !made.length ? { id: searchId, teamId: search.teamId, date: search.date } : null;
    return { lost: lost.length, closed, declined, expired };
  });

  await notifyProposalsDeclined(outcome.declined);
  if (outcome.expired) await notifySearchExpired(outcome.expired);
  return { lost: outcome.lost, closed: outcome.closed };
}
