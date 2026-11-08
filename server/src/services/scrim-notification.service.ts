// What the matchmaking tells the teams. Each function reads the facts of what
// just happened, once it is done, and hands them to notify(): who is told is
// decided here, how they are told is not.

import type { Prisma } from '@prisma/client';
import { prisma } from '@db/prisma';
import type { ScrimDeclineReason, ScrimMatchFacts } from '@shared/types';
import { notify, type PermissionRef } from '@services/notification.service';
import { formatDateStr } from './helpers/date.helper';

// What the notifications about a proposal are told from
export const PROPOSAL_FACTS_SELECT = {
  id: true,
  teamId: true,
  startTime: true,
  endTime: true,
  arenaNumber: true,
  message: true,
  team: { select: { name: true } },
  venue: { select: { id: true, name: true, arenaCount: true } },
  search: { select: { id: true, date: true, teamId: true, team: { select: { name: true } } } },
} satisfies Prisma.ScrimProposalSelect;

export type ProposalFacts = Prisma.ScrimProposalGetPayload<{ select: typeof PROPOSAL_FACTS_SELECT }>;

// A proposal declined, and why
export type DeclinedProposal = { id: string; reason: ScrimDeclineReason };

const CAN_SEARCH: PermissionRef = { category: 'matchmaking', name: 'canSearch' };
const CAN_PROPOSE: PermissionRef = { category: 'matchmaking', name: 'canPropose' };
const CAN_RESPOND: PermissionRef = { category: 'matchmaking', name: 'canRespond' };

// Where and when the match of a proposal is played
function matchFacts(proposal: ProposalFacts): ScrimMatchFacts {
  return {
    date: formatDateStr(proposal.search.date),
    startTime: proposal.startTime,
    endTime: proposal.endTime,
    venueId: proposal.venue.id,
    venueName: proposal.venue.name.trim(),
    arenaNumber: proposal.venue.arenaCount > 1 ? proposal.arenaNumber : null,
  };
}

async function loadFacts(proposalIds: string[]): Promise<ProposalFacts[]> {
  if (!proposalIds.length) return [];
  return prisma.scrimProposal.findMany({ where: { id: { in: proposalIds } }, select: PROPOSAL_FACTS_SELECT });
}

/** A team proposed a match: those who answer for the searching team hear of it */
export async function notifyProposalReceived(proposalId: string): Promise<void> {
  const [proposal] = await loadFacts([proposalId]);
  if (!proposal) return;
  await notify(
    {
      kind: 'SCRIM_PROPOSAL_RECEIVED',
      data: { ...matchFacts(proposal), searchId: proposal.search.id, teamName: proposal.team.name, message: proposal.message },
    },
    { teamId: proposal.search.teamId, permission: CAN_RESPOND },
  );
}

/**
 * A proposal was accepted: both teams hear of the match, each told of its own
 * copy; the player who accepted is told nothing
 */
export async function notifyMatchMade(
  proposalId: string,
  eventIds: { searcher: string; proposer: string },
  acceptedBy: string | undefined,
): Promise<void> {
  const [proposal] = await loadFacts([proposalId]);
  if (!proposal) return;
  const facts = matchFacts(proposal);
  await notify(
    { kind: 'SCRIM_MATCH_MADE', data: { ...facts, eventId: eventIds.searcher, opponentName: proposal.team.name } },
    { teamId: proposal.search.teamId, exceptPlayerId: acceptedBy },
  );
  await notify(
    { kind: 'SCRIM_MATCH_MADE', data: { ...facts, eventId: eventIds.proposer, opponentName: proposal.search.team.name } },
    { teamId: proposal.teamId },
  );
}

/** Proposals declined: those who propose for each team hear of it, and why */
export async function notifyProposalsDeclined(declined: DeclinedProposal[]): Promise<void> {
  const reasons = new Map(declined.map(item => [item.id, item.reason]));
  for (const proposal of await loadFacts([...reasons.keys()])) {
    await notify(
      {
        kind: 'SCRIM_PROPOSAL_DECLINED',
        data: { ...matchFacts(proposal), searchId: proposal.search.id, teamName: proposal.search.team.name, reason: reasons.get(proposal.id)! },
      },
      { teamId: proposal.teamId, permission: CAN_PROPOSE },
    );
  }
}

/**
 * A search was withdrawn: those who propose for each team that waited on it
 * hear of it. Takes the pending proposals as read before the withdrawal, which
 * can delete them.
 */
export async function notifySearchWithdrawn(pending: ProposalFacts[]): Promise<void> {
  for (const proposal of pending) {
    await notify(
      { kind: 'SCRIM_SEARCH_WITHDRAWN', data: { ...matchFacts(proposal), teamName: proposal.search.team.name } },
      { teamId: proposal.teamId, permission: CAN_PROPOSE },
    );
  }
}

/** A match was called off: both teams hear of it, and from which side; the player who did it is told nothing */
export async function notifyMatchCancelled(
  proposal: ProposalFacts,
  cancelledByTeamId: string,
  cancelledBy: string | undefined,
): Promise<void> {
  const facts = matchFacts(proposal);
  const sides = [
    { teamId: proposal.search.teamId, opponentName: proposal.team.name },
    { teamId: proposal.teamId, opponentName: proposal.search.team.name },
  ];
  for (const { teamId, opponentName } of sides) {
    const byOpponent = teamId !== cancelledByTeamId;
    await notify(
      { kind: 'SCRIM_MATCH_CANCELLED', data: { ...facts, opponentName, byOpponent } },
      { teamId, exceptPlayerId: byOpponent ? undefined : cancelledBy },
    );
  }
}

/** A search closed with no match, its slots booked at the venue: those who search for the team hear of it */
export async function notifySearchExpired(search: { id: string; teamId: string; date: Date }): Promise<void> {
  await notify(
    { kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId: search.id, date: formatDateStr(search.date) } },
    { teamId: search.teamId, permission: CAN_SEARCH },
  );
}
