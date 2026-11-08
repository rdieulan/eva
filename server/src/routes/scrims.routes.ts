// Scrim routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { CreateScrimSearchRequest, CreateScrimProposalRequest, ScrimVenueOffer, UpdateScrimSearchRequest } from '@shared/types';
import {
  ERROR,
  EVA_SLOT_ID_MAX_LENGTH,
  EVA_SLOTS_PER_MATCH_MAX,
  SCRIM_OFFER_SLOTS_MAX,
  SCRIM_PROPOSAL_MESSAGE_MAX_LENGTH,
  SCRIM_MATCH_SLOTS_MIN,
  SCRIM_MATCH_SLOTS_MAX,
  SCRIM_MATCH_COUNT_MIN,
  SCRIM_MATCH_COUNT_MAX,
  SCRIM_SEARCH_VENUES_MAX,
} from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as scrimSearchService from '@services/scrim-search.service';
import type {
  CreateScrimSearchRefusal,
  DeleteScrimSearchRefusal,
  OfferRefusal,
  UpdateScrimSearchRefusal,
} from '@services/scrim-search.service';
import * as scrimProposalService from '@services/scrim-proposal.service';
import type {
  CancelScrimMatchRefusal,
  CreateScrimProposalRefusal,
  RespondScrimProposalRefusal,
  WithdrawScrimProposalRefusal,
} from '@services/scrim-proposal.service';
import { isValidDate, isValidMonth } from '@services/helpers/validation.helper';
import { EvaApiError } from '../integrations/eva/eva-graphql';

const router = Router();

// How each refusal of the service answers
const OFFER_REFUSALS: Record<OfferRefusal, { status: number; error: string }> = {
  venueNotFound: { status: 404, error: ERROR.venueNotFound },
  venueNotOnEva: { status: 409, error: ERROR.venueNotOnEva },
  slotsUnknown: { status: 400, error: ERROR.scrimSearchSlotsUnknown },
  slotsOtherGame: { status: 409, error: ERROR.scrimSearchSlotsOtherGame },
  slotsNotCompetitive: { status: 409, error: ERROR.scrimSearchSlotsNotCompetitive },
  slotsNotFree: { status: 409, error: ERROR.scrimSearchSlotsNotFree },
  slotsPassQuota: { status: 409, error: ERROR.scrimSearchSlotsPassQuota },
};

const CREATE_REFUSALS: Record<CreateScrimSearchRefusal, { status: number; error: string }> = {
  ...OFFER_REFUSALS,
  dateInPast: { status: 400, error: ERROR.scrimSearchDateInPast },
  offerTooShort: { status: 400, error: ERROR.scrimSearchOfferTooShort },
  alreadySearching: { status: 409, error: ERROR.scrimSearchAlreadyOpen },
};

const UPDATE_REFUSALS: Record<UpdateScrimSearchRefusal, { status: number; error: string }> = {
  ...OFFER_REFUSALS,
  notFound: { status: 404, error: ERROR.scrimSearchNotFound },
  notYours: { status: 403, error: ERROR.accessDenied },
  notOpen: { status: 409, error: ERROR.scrimSearchNotOpen },
  dateInPast: { status: 400, error: ERROR.scrimSearchDateInPast },
  offerTooShort: { status: 400, error: ERROR.scrimSearchOfferTooShort },
  matchCountTooLow: { status: 400, error: ERROR.scrimSearchMatchCountTooLow },
};

const DELETE_REFUSALS: Record<DeleteScrimSearchRefusal, { status: number; error: string }> = {
  notFound: { status: 404, error: ERROR.scrimSearchNotFound },
  notYours: { status: 403, error: ERROR.accessDenied },
  notOpen: { status: 409, error: ERROR.scrimSearchNotOpen },
};

const PROPOSE_REFUSALS: Record<CreateScrimProposalRefusal, { status: number; error: string }> = {
  searchNotFound: { status: 404, error: ERROR.scrimSearchNotFound },
  searchNotOpen: { status: 409, error: ERROR.scrimSearchNotOpen },
  ownSearch: { status: 400, error: ERROR.scrimProposalOwnSearch },
  alreadySent: { status: 409, error: ERROR.scrimProposalAlreadySent },
  dateInPast: { status: 400, error: ERROR.scrimSearchDateInPast },
  slotsNotOffered: { status: 400, error: ERROR.scrimProposalSlotsNotOffered },
  timeTaken: { status: 409, error: ERROR.scrimProposalTimeTaken },
  slotsNotConsecutive: { status: 400, error: ERROR.scrimSlotsNotConsecutive },
  runLength: { status: 400, error: ERROR.scrimProposalRunLength },
  runTaken: { status: 409, error: ERROR.scrimProposalRunTaken },
  venueNotFound: { status: 404, error: ERROR.venueNotFound },
  venueNotOnEva: { status: 409, error: ERROR.venueNotOnEva },
};

const RESPOND_REFUSALS: Record<RespondScrimProposalRefusal, { status: number; error: string }> = {
  notFound: { status: 404, error: ERROR.scrimProposalNotFound },
  notYours: { status: 403, error: ERROR.accessDenied },
  notPending: { status: 409, error: ERROR.scrimProposalNotPending },
  searchNotOpen: { status: 409, error: ERROR.scrimSearchNotOpen },
  timeTaken: { status: 409, error: ERROR.scrimProposalTimeTaken },
  runTaken: { status: 409, error: ERROR.scrimProposalRunTaken },
};

const CANCEL_REFUSALS: Record<CancelScrimMatchRefusal, { status: number; error: string }> = {
  notFound: { status: 404, error: ERROR.scrimMatchNotFound },
  notYours: { status: 403, error: ERROR.accessDenied },
  matchPast: { status: 400, error: ERROR.scrimMatchPast },
};

const WITHDRAW_REFUSALS: Record<WithdrawScrimProposalRefusal, { status: number; error: string }> = {
  notFound: { status: 404, error: ERROR.scrimProposalNotFound },
  notYours: { status: 403, error: ERROR.accessDenied },
  notPending: { status: 409, error: ERROR.scrimProposalNotPending },
};

// The optional word to the other team: trimmed, bounded, null when empty
function readProposalMessage(input: unknown): { message: string | null } | { error: string } {
  if (input === undefined || input === null) return { message: null };
  if (typeof input !== 'string') return { error: ERROR.scrimProposalMessageTooLong };
  const clean = input.trim();
  if (clean.length > SCRIM_PROPOSAL_MESSAGE_MAX_LENGTH) return { error: ERROR.scrimProposalMessageTooLong };
  return { message: clean || null };
}

// The slot ids as the client sends them: distinct, bounded, one at least
function readSlotIds(input: unknown, max: number): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > max) return null;
  const ids: string[] = [];
  for (const id of input) {
    if (typeof id !== 'string') return null;
    const clean = id.trim();
    if (!clean || clean.length > EVA_SLOT_ID_MAX_LENGTH || ids.includes(clean)) return null;
    ids.push(clean);
  }
  return ids;
}

// The venues of a listing, comma-separated: distinct, a few at most, one at least
function readVenueIds(input: unknown): string[] | null {
  if (typeof input !== 'string') return null;
  const ids = input.split(',').map(id => id.trim());
  if (ids.some(id => !id) || new Set(ids).size !== ids.length || ids.length > SCRIM_SEARCH_VENUES_MAX) return null;
  return ids;
}

// The venues of an offer as the client sends them: distinct venues, a few at
// most, each with its slots; the slots of the whole offer distinct and bounded.
// Says whether the venues or the slots are at fault.
function readVenueOffers(input: unknown): { offers: ScrimVenueOffer[] } | { error: string } {
  const venuesInvalid = { error: ERROR.scrimSearchVenuesInvalid };
  const slotsInvalid = { error: ERROR.scrimOfferSlotsInvalid };
  if (!Array.isArray(input) || input.length === 0 || input.length > SCRIM_SEARCH_VENUES_MAX) return venuesInvalid;
  const offers: ScrimVenueOffer[] = [];
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) return venuesInvalid;
    const { venueId, evaSlotIds } = entry as Record<string, unknown>;
    if (typeof venueId !== 'string' || !venueId || offers.some(offer => offer.venueId === venueId)) return venuesInvalid;
    const slotIds = readSlotIds(evaSlotIds, SCRIM_OFFER_SLOTS_MAX);
    if (!slotIds) return slotsInvalid;
    offers.push({ venueId, evaSlotIds: slotIds });
  }
  const all = offers.flatMap(offer => offer.evaSlotIds);
  if (all.length > SCRIM_OFFER_SLOTS_MAX || new Set(all).size !== all.length) return slotsInvalid;
  return { offers };
}

// How long a match is and how many the team wants, as the client sends them
function readMatchSettings(slotCount: unknown, matchCount: unknown): { error: string } | null {
  if (!Number.isInteger(slotCount) || (slotCount as number) < SCRIM_MATCH_SLOTS_MIN || (slotCount as number) > SCRIM_MATCH_SLOTS_MAX) {
    return { error: ERROR.scrimSearchSlotCountInvalid };
  }
  if (!Number.isInteger(matchCount) || (matchCount as number) < SCRIM_MATCH_COUNT_MIN || (matchCount as number) > SCRIM_MATCH_COUNT_MAX) {
    return { error: ERROR.scrimSearchMatchCountInvalid };
  }
  return null;
}

// GET /api/scrims/searches?month=YYYY-MM[&venueIds=a,b] - Open searches: in some venues, or the team's own
router.get('/searches', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { month } = req.query;
  const teamId = req.account?.teamId;

  if (!isValidMonth(month)) {
    return res.status(400).json({ errors: [ERROR.monthParamRequired] });
  }
  const venueIds = req.query.venueIds === undefined ? undefined : readVenueIds(req.query.venueIds);
  if (venueIds === null) {
    return res.status(400).json({ errors: [ERROR.scrimSearchVenuesInvalid] });
  }
  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }

  try {
    const searches = await scrimSearchService.listScrimSearches({ month, venueIds, teamId });
    res.json(searches);
  } catch (error) {
    apiLogger.error('Error listing scrim searches:', error);
    res.status(500).json({ errors: [ERROR.scrimSearchesFetchFailed] });
  }
});

// POST /api/scrims/searches - Offer slots of one venue or more, for a day, for one or more matches
router.post('/searches', authMiddleware, requirePermission('matchmaking', 'canSearch'), async (req: AuthRequest, res: Response) => {
  const { date, venues: venuesInput, slotCount, matchCount } = req.body as CreateScrimSearchRequest;
  const teamId = req.account?.teamId;

  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ errors: [ERROR.dateInvalid] });
  }
  const read = readVenueOffers(venuesInput);
  if ('error' in read) {
    return res.status(400).json({ errors: [read.error] });
  }
  const settings = readMatchSettings(slotCount, matchCount);
  if (settings) {
    return res.status(400).json({ errors: [settings.error] });
  }

  try {
    const result = await scrimSearchService.createScrimSearch({
      teamId,
      createdById: req.account!.playerId!,
      date,
      venues: read.offers,
      slotCount,
      matchCount,
    });
    if ('refusal' in result) {
      const { status, error } = CREATE_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.status(201).json(result.search);
  } catch (error) {
    apiLogger.error('Error opening a scrim search:', error);
    const isUpstream = error instanceof EvaApiError || error instanceof TypeError;
    res.status(isUpstream ? 502 : 500).json({ errors: [isUpstream ? ERROR.evaUnavailable : ERROR.scrimSearchCreateFailed] });
  }
});

// PUT /api/scrims/searches/:id - Change the slots, the match length or the number of matches of one of the team's open searches
router.put('/searches/:id', authMiddleware, requirePermission('matchmaking', 'canSearch'), async (req: AuthRequest, res: Response) => {
  const { venues: venuesInput, slotCount, matchCount } = (req.body ?? {}) as UpdateScrimSearchRequest;
  const teamId = req.account?.teamId;

  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }
  const read = readVenueOffers(venuesInput);
  if ('error' in read) {
    return res.status(400).json({ errors: [read.error] });
  }
  const settings = readMatchSettings(slotCount, matchCount);
  if (settings) {
    return res.status(400).json({ errors: [settings.error] });
  }

  try {
    const result = await scrimSearchService.updateScrimSearch({
      id: req.params.id,
      teamId,
      venues: read.offers,
      slotCount,
      matchCount,
    });
    if ('refusal' in result) {
      const { status, error } = UPDATE_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.json(result.search);
  } catch (error) {
    apiLogger.error('Error changing a scrim search:', error);
    const isUpstream = error instanceof EvaApiError || error instanceof TypeError;
    res.status(isUpstream ? 502 : 500).json({ errors: [isUpstream ? ERROR.evaUnavailable : ERROR.scrimSearchUpdateFailed] });
  }
});

// DELETE /api/scrims/searches/:id - Withdraw one of the team's open searches
router.delete('/searches/:id', authMiddleware, requirePermission('matchmaking', 'canSearch'), async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;
  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }

  try {
    const result = await scrimSearchService.deleteScrimSearch(req.params.id, teamId);
    if (result.refusal) {
      const { status, error } = DELETE_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.status(204).end();
  } catch (error) {
    apiLogger.error('Error withdrawing a scrim search:', error);
    res.status(500).json({ errors: [ERROR.scrimSearchDeleteFailed] });
  }
});

// ============================================
// Proposals
// ============================================

// POST /api/scrims/searches/:id/proposals - Answer another team's search
router.post('/searches/:id/proposals', authMiddleware, requirePermission('matchmaking', 'canPropose'), async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;
  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }

  const { message, evaSlotIds } = (req.body ?? {}) as CreateScrimProposalRequest;
  const read = readProposalMessage(message);
  if ('error' in read) {
    return res.status(400).json({ errors: [read.error] });
  }
  const slotIds = readSlotIds(evaSlotIds, EVA_SLOTS_PER_MATCH_MAX);
  if (!slotIds) {
    return res.status(400).json({ errors: [ERROR.evaSlotsInvalid] });
  }

  try {
    const result = await scrimProposalService.createScrimProposal({
      searchId: req.params.id,
      teamId,
      createdById: req.account!.playerId!,
      evaSlotIds: slotIds,
      message: read.message,
    });
    if ('refusal' in result) {
      const { status, error } = PROPOSE_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.status(201).json(result.proposal);
  } catch (error) {
    apiLogger.error('Error proposing a scrim:', error);
    const isUpstream = error instanceof EvaApiError || error instanceof TypeError;
    res.status(isUpstream ? 502 : 500).json({ errors: [isUpstream ? ERROR.evaUnavailable : ERROR.scrimProposalCreateFailed] });
  }
});

// PUT /api/scrims/proposals/:id/accept - Take the proposal: the match lands in both calendars
router.put('/proposals/:id/accept', authMiddleware, requirePermission('matchmaking', 'canRespond'), async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;
  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }

  try {
    const result = await scrimProposalService.acceptScrimProposal(req.params.id, teamId, req.account?.playerId);
    if ('refusal' in result) {
      const { status, error } = RESPOND_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.json(result);
  } catch (error) {
    apiLogger.error('Error accepting a scrim proposal:', error);
    const isUpstream = error instanceof EvaApiError || error instanceof TypeError;
    res.status(isUpstream ? 502 : 500).json({ errors: [isUpstream ? ERROR.evaUnavailable : ERROR.scrimProposalRespondFailed] });
  }
});

// PUT /api/scrims/proposals/:id/decline - Turn the proposal down; the search stays open
router.put('/proposals/:id/decline', authMiddleware, requirePermission('matchmaking', 'canRespond'), async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;
  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }

  try {
    const result = await scrimProposalService.declineScrimProposal(req.params.id, teamId);
    if ('refusal' in result) {
      const { status, error } = RESPOND_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.json(result.proposal);
  } catch (error) {
    apiLogger.error('Error declining a scrim proposal:', error);
    res.status(500).json({ errors: [ERROR.scrimProposalRespondFailed] });
  }
});

// DELETE /api/scrims/proposals/:id - Take back one of the team's pending proposals
router.delete('/proposals/:id', authMiddleware, requirePermission('matchmaking', 'canPropose'), async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;
  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }

  try {
    const result = await scrimProposalService.withdrawScrimProposal(req.params.id, teamId);
    if (result.refusal) {
      const { status, error } = WITHDRAW_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.status(204).end();
  } catch (error) {
    apiLogger.error('Error withdrawing a scrim proposal:', error);
    res.status(500).json({ errors: [ERROR.scrimProposalWithdrawFailed] });
  }
});

// ============================================
// Matches made
// ============================================

// DELETE /api/scrims/matches/:eventId - Call off a match the matchmaking made, from the team's copy: both calendars lose it
router.delete('/matches/:eventId', authMiddleware, requirePermission('matchmaking', 'canRespond'), async (req: AuthRequest, res: Response) => {
  const teamId = req.account?.teamId;
  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }

  try {
    const result = await scrimProposalService.cancelScrimMatch(req.params.eventId, teamId, req.account?.playerId);
    if (result.refusal) {
      const { status, error } = CANCEL_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.status(204).end();
  } catch (error) {
    apiLogger.error('Error calling a scrim match off:', error);
    res.status(500).json({ errors: [ERROR.scrimMatchCancelFailed] });
  }
});

export default router;
