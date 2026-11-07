// Scrim proposals - a team answers another team's search with the run it wants to play

import { prisma } from '@db/prisma';
import type { CalendarEvent, ScrimProposal, ScrimProposalStatus, VenueSlot } from '@shared/types';
import { countMatches, isOneRun, orderRunSlots, runSpan, spansOverlap } from '@shared/utils';
import { logoUrlOf } from '@services/teams.service';
import { getVenueSlots } from '@services/venue-slots.service';
import { formatDateStr } from './helpers/date.helper';
import { slotPlayability } from './helpers/slot.helper';
import { EVENT_VENUE_INCLUDE, formatEventForFrontend } from './helpers/calendar.helper';

// The team behind a proposal, as loaded with it
export const PROPOSAL_TEAM_INCLUDE = {
  team: { select: { id: true, name: true, logoType: true, logoUpdatedAt: true } },
} as const;

export type ProposalRow = {
  id: string;
  searchId: string;
  teamId: string;
  message: string | null;
  status: ScrimProposalStatus;
  venueId: string;
  evaSlotIds: string[];
  arenaNumber: number;
  startTime: string;
  endTime: string;
  convocationTime: string;
  createdAt: Date;
  team: { id: string; name: string; logoType: string | null; logoUpdatedAt: Date | null };
};

export function toScrimProposal(row: ProposalRow, readerTeamId: string): ScrimProposal {
  return {
    id: row.id,
    searchId: row.searchId,
    team: { id: row.team.id, name: row.team.name, logoUrl: logoUrlOf(row.team) },
    message: row.message,
    status: row.status,
    venueId: row.venueId,
    evaSlotIds: row.evaSlotIds,
    arenaNumber: row.arenaNumber,
    startTime: row.startTime,
    endTime: row.endTime,
    convocationTime: row.convocationTime,
    isMine: row.teamId === readerTeamId,
    createdAt: row.createdAt.toISOString(),
  };
}

// What the two teams see of the match in their calendars
const MATCHMAKING_DESCRIPTION = 'Match trouvé par le matchmaking.';

// When a search's matches are already played, as loaded with it: the team
// plays one at a time, so no other match of the search can fall then
const ACCEPTED_RUNS = { where: { status: 'ACCEPTED' as const }, select: { startTime: true, endTime: true } } as const;

// ============================================
// Proposing
// ============================================

export type CreateScrimProposalRefusal =
  | 'searchNotFound'
  | 'searchNotOpen'        // The search already has its matches
  | 'ownSearch'            // A team does not answer its own search
  | 'alreadySent'          // The team already has a pending proposal on it
  | 'dateInPast'
  | 'slotsNotOffered'      // A slot the search does not offer
  | 'timeTaken'            // At the time of a match the search already made
  | 'slotsNotConsecutive'  // Not one run on one arena of one venue
  | 'runLength'            // Not the number of slots the search asks for
  | 'runTaken'             // A slot of the run no longer open to a match: booked by someone since, or the like
  | 'venueNotFound'        // The venue of the run is gone, or no longer on eva.gg
  | 'venueNotOnEva';

export type CreateScrimProposalResult = { proposal: ScrimProposal } | { refusal: CreateScrimProposalRefusal };

/**
 * Answer an open search of another team with the run of one match:
 * consecutive slots on one arena of one of its venues, all among those the
 * search offers, none at the time of a match the search already made. A team
 * that already plays one of the search's matches may propose another. The run
 * is read from eva.gg so the proposal, and the match it may become, carry its
 * real times.
 * Expects distinct slot ids, one at least, and a trimmed message or null.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
export async function createScrimProposal(input: {
  searchId: string;
  teamId: string;
  createdById: string;
  evaSlotIds: string[];
  message: string | null;
}): Promise<CreateScrimProposalResult> {
  const search = await prisma.scrimSearch.findUnique({
    where: { id: input.searchId },
    select: {
      teamId: true,
      status: true,
      date: true,
      slotCount: true,
      slots: { select: { evaSlotId: true, venueId: true, startTime: true, endTime: true } },
      proposals: ACCEPTED_RUNS,
    },
  });
  if (!search) return { refusal: 'searchNotFound' };
  if (search.teamId === input.teamId) return { refusal: 'ownSearch' };
  if (search.status !== 'OPEN') return { refusal: 'searchNotOpen' };
  const date = formatDateStr(search.date);
  if (date < formatDateStr(new Date())) return { refusal: 'dateInPast' };
  const offered = input.evaSlotIds.map(slotId => search.slots.find(slot => slot.evaSlotId === slotId));
  if (offered.some(slot => !slot)) return { refusal: 'slotsNotOffered' };
  const busy = search.proposals.map(runSpan);
  if (offered.some(slot => busy.some(span => spansOverlap(span, runSpan(slot!))))) return { refusal: 'timeTaken' };
  const venueIds = new Set(offered.map(slot => slot!.venueId));
  if (venueIds.size > 1) return { refusal: 'slotsNotConsecutive' };
  if (input.evaSlotIds.length !== search.slotCount) return { refusal: 'runLength' };
  const venueId = offered[0]!.venueId;

  const daySlots = await getVenueSlots(venueId, date);
  if ('refusal' in daySlots) return { refusal: daySlots.refusal };

  const run: VenueSlot[] = [];
  for (const slotId of input.evaSlotIds) {
    const slot = daySlots.slots.find(candidate => candidate.slotId === slotId);
    // Offered by the search, so eva.gg listed it; gone since means the day changed on their side
    if (!slot) return { refusal: 'slotsNotOffered' };
    run.push(slot);
  }
  run.sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (!isOneRun(run)) return { refusal: 'slotsNotConsecutive' };
  // Free when the search opened, not necessarily still: anyone can book a slot at the venue
  if (run.some(slot => slotPlayability(slot) !== 'playable')) return { refusal: 'runTaken' };

  const pending = await prisma.scrimProposal.findFirst({
    where: { searchId: input.searchId, teamId: input.teamId, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) return { refusal: 'alreadySent' };

  const first = run[0]!;
  const last = run[run.length - 1]!;
  const row = await prisma.scrimProposal.create({
    data: {
      searchId: input.searchId,
      teamId: input.teamId,
      createdById: input.createdById,
      message: input.message,
      venueId,
      evaSlotIds: run.map(slot => slot.slotId),
      arenaNumber: first.arenaNumber,
      startTime: first.startTime,
      endTime: last.endTime,
      convocationTime: first.convocationTime,
    },
    include: PROPOSAL_TEAM_INCLUDE,
  });

  return { proposal: toScrimProposal(row, input.teamId) };
}

// ============================================
// Answering
// ============================================

export type RespondScrimProposalRefusal =
  | 'notFound'
  | 'notYours'      // Only the team that opened the search answers
  | 'notPending'    // Already answered or withdrawn
  | 'searchNotOpen'
  | 'timeTaken'     // Accepting: another match of the search took that time meanwhile
  | 'runTaken';     // Accepting: a slot of the run is no longer open to a match; the proposal is declined

export type AcceptScrimProposalResult =
  | { proposal: ScrimProposal; events: CalendarEvent[] }
  | { refusal: RespondScrimProposalRefusal };

async function loadProposalForResponse(proposalId: string) {
  return prisma.scrimProposal.findUnique({
    where: { id: proposalId },
    include: {
      ...PROPOSAL_TEAM_INCLUDE,
      search: { include: { team: { select: { id: true, name: true } } } },
    },
  });
}

/**
 * Accept a proposal on one of the team's searches: the match lands in both
 * calendars on the run the proposal named, and the pending proposals at the
 * same time are declined, wherever they are played: the team plays one match
 * at a time. The search closes, declining every other pending proposal, once
 * it has all its matches or its remaining slots no longer hold one. Answers
 * on one search are taken one at a time, so two matches never overlap nor
 * outnumber what the search asked for.
 */
export async function acceptScrimProposal(proposalId: string, teamId: string): Promise<AcceptScrimProposalResult> {
  const check = await checkRunStillFree(proposalId, teamId);
  if (check) return { refusal: check };

  return prisma.$transaction(async tx => {
    const target = await tx.scrimProposal.findUnique({ where: { id: proposalId }, select: { searchId: true } });
    if (!target) return { refusal: 'notFound' as const };
    await tx.$queryRaw`SELECT 1 FROM "ScrimSearch" WHERE "id" = ${target.searchId} FOR UPDATE`;

    const proposal = await tx.scrimProposal.findUnique({
      where: { id: proposalId },
      include: {
        ...PROPOSAL_TEAM_INCLUDE,
        search: {
          include: {
            team: { select: { id: true, name: true } },
            slots: { select: { venueId: true, arenaNumber: true, startTime: true, endTime: true } },
            proposals: ACCEPTED_RUNS,
          },
        },
      },
    });
    if (!proposal) return { refusal: 'notFound' as const };
    if (proposal.search.teamId !== teamId) return { refusal: 'notYours' as const };
    if (proposal.status !== 'PENDING') return { refusal: 'notPending' as const };
    if (proposal.search.status !== 'OPEN') return { refusal: 'searchNotOpen' as const };

    const { search } = proposal;
    const span = runSpan(proposal);
    const busy = search.proposals.map(runSpan);
    if (busy.some(taken => spansOverlap(taken, span))) return { refusal: 'timeTaken' as const };
    busy.push(span);
    const closes = search.proposals.length + 1 >= search.matchCount
      || countMatches(orderRunSlots(search.slots), search.slotCount, busy) === 0;

    const now = new Date();
    const accepted = await tx.scrimProposal.update({
      where: { id: proposal.id },
      data: { status: 'ACCEPTED', respondedAt: now },
      include: PROPOSAL_TEAM_INCLUDE,
    });
    const pending = await tx.scrimProposal.findMany({
      where: { searchId: search.id, status: 'PENDING' },
      select: { id: true, startTime: true, endTime: true },
    });
    const declined = closes ? pending : pending.filter(other => spansOverlap(runSpan(other), span));
    await tx.scrimProposal.updateMany({
      where: { id: { in: declined.map(other => other.id) } },
      data: { status: 'DECLINED', respondedAt: now },
    });
    if (closes) {
      await tx.scrimSearch.update({ where: { id: search.id }, data: { status: 'MATCHED' } });
    }

    const matchBase = {
      date: search.date,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      type: 'MATCH' as const,
      description: MATCHMAKING_DESCRIPTION,
      venueId: proposal.venueId,
      arenaNumber: proposal.arenaNumber,
      evaSlotIds: proposal.evaSlotIds,
      scrimSearchId: search.id,
    };
    const searcherEvent = await tx.calendarEvent.create({
      data: { ...matchBase, title: `Scrim vs ${proposal.team.name}`, teamId: search.teamId, createdById: search.createdById },
      include: EVENT_VENUE_INCLUDE,
    });
    const proposerEvent = await tx.calendarEvent.create({
      data: { ...matchBase, title: `Scrim vs ${search.team.name}`, teamId: proposal.teamId, createdById: proposal.createdById },
      include: EVENT_VENUE_INCLUDE,
    });

    return {
      proposal: toScrimProposal(accepted, teamId),
      events: [formatEventForFrontend(searcherEvent), formatEventForFrontend(proposerEvent)],
    };
  });
}

/**
 * Before a match is made: its run read again from eva.gg, since anyone can
 * book a slot at the venue after the proposal was sent. A run no longer open
 * to a match declines the proposal. Answers with the refusal, or null to go
 * on; the acceptance checks the rest again under its lock. Read out of any
 * transaction: eva.gg can take its time.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
async function checkRunStillFree(proposalId: string, teamId: string): Promise<RespondScrimProposalRefusal | null> {
  const proposal = await prisma.scrimProposal.findUnique({
    where: { id: proposalId },
    select: { status: true, venueId: true, evaSlotIds: true, search: { select: { teamId: true, status: true, date: true } } },
  });
  if (!proposal) return 'notFound';
  if (proposal.search.teamId !== teamId) return 'notYours';
  if (proposal.status !== 'PENDING') return 'notPending';
  if (proposal.search.status !== 'OPEN') return 'searchNotOpen';

  const daySlots = await getVenueSlots(proposal.venueId, formatDateStr(proposal.search.date));
  // A venue gone from eva.gg cannot be read again: the run keeps what it was
  if ('refusal' in daySlots) return null;
  const isFree = proposal.evaSlotIds.every(slotId => {
    const slot = daySlots.slots.find(candidate => candidate.slotId === slotId);
    return slot !== undefined && slotPlayability(slot) === 'playable';
  });
  if (isFree) return null;

  await prisma.scrimProposal.updateMany({
    where: { id: proposalId, status: 'PENDING' },
    data: { status: 'DECLINED', respondedAt: new Date() },
  });
  return 'runTaken';
}

export type DeclineScrimProposalResult = { proposal: ScrimProposal } | { refusal: RespondScrimProposalRefusal };

/**
 * Decline a proposal on one of the team's searches; the search stays as it is
 */
export async function declineScrimProposal(proposalId: string, teamId: string): Promise<DeclineScrimProposalResult> {
  const proposal = await loadProposalForResponse(proposalId);
  if (!proposal) return { refusal: 'notFound' };
  if (proposal.search.teamId !== teamId) return { refusal: 'notYours' };
  if (proposal.status !== 'PENDING') return { refusal: 'notPending' };

  const declined = await prisma.scrimProposal.update({
    where: { id: proposal.id },
    data: { status: 'DECLINED', respondedAt: new Date() },
    include: PROPOSAL_TEAM_INCLUDE,
  });
  return { proposal: toScrimProposal(declined, teamId) };
}

// ============================================
// Withdrawing
// ============================================

export type WithdrawScrimProposalRefusal = 'notFound' | 'notYours' | 'notPending';

/**
 * Take back a pending proposal of the team
 */
export async function withdrawScrimProposal(proposalId: string, teamId: string): Promise<{ refusal?: WithdrawScrimProposalRefusal }> {
  const proposal = await prisma.scrimProposal.findUnique({
    where: { id: proposalId },
    select: { teamId: true, status: true },
  });
  if (!proposal) return { refusal: 'notFound' };
  if (proposal.teamId !== teamId) return { refusal: 'notYours' };
  if (proposal.status !== 'PENDING') return { refusal: 'notPending' };

  await prisma.scrimProposal.update({
    where: { id: proposalId },
    data: { status: 'WITHDRAWN', respondedAt: new Date() },
  });
  return {};
}

// ============================================
// Calling a match off
// ============================================

export type CancelScrimMatchRefusal = 'notFound' | 'notYours' | 'matchPast';

/**
 * Call off a match the matchmaking made, from the copy of either team, up to
 * its day: both calendars lose it, and its proposal says it was called off. A
 * search still open gets the time of the match back for another one; a closed
 * search stays closed. A match whose day has passed stays in both calendars:
 * one team does not erase what the two played. Taken one at a time with the
 * answers and changes on the search. The bookings the two teams made on
 * eva.gg are theirs to cancel there: the matchmaking cannot see them.
 */
export async function cancelScrimMatch(eventId: string, teamId: string): Promise<{ refusal?: CancelScrimMatchRefusal }> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { teamId: true, scrimSearchId: true, date: true, startTime: true },
  });
  if (!event || !event.scrimSearchId) return { refusal: 'notFound' };
  if (event.teamId !== teamId) return { refusal: 'notYours' };
  if (formatDateStr(event.date) < formatDateStr(new Date())) return { refusal: 'matchPast' };
  const searchId = event.scrimSearchId;

  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM "ScrimSearch" WHERE "id" = ${searchId} FOR UPDATE`;
    // Two matches of a search never share a start: its time names the match
    await tx.scrimProposal.updateMany({
      where: { searchId, status: 'ACCEPTED', startTime: event.startTime },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });
    await tx.calendarEvent.deleteMany({ where: { scrimSearchId: searchId, date: event.date, startTime: event.startTime } });
  });
  return {};
}
