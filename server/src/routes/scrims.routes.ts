// Scrim routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { CreateScrimSearchRequest } from '@shared/types';
import { ERROR, EVA_SLOT_ID_MAX_LENGTH, EVA_SLOTS_PER_MATCH_MAX } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as scrimSearchService from '@services/scrim-search.service';
import type { CreateScrimSearchRefusal, DeleteScrimSearchRefusal } from '@services/scrim-search.service';
import { isValidDate, isValidMonth } from '@services/helpers/validation.helper';
import { EvaApiError } from '../integrations/eva/eva-graphql';

const router = Router();

// How each refusal of the service answers
const CREATE_REFUSALS: Record<CreateScrimSearchRefusal, { status: number; error: string }> = {
  venueNotFound: { status: 404, error: ERROR.venueNotFound },
  venueNotOnEva: { status: 409, error: ERROR.venueNotOnEva },
  dateInPast: { status: 400, error: ERROR.scrimSearchDateInPast },
  slotsUnknown: { status: 400, error: ERROR.scrimSearchSlotsUnknown },
  slotsNotConsecutive: { status: 400, error: ERROR.scrimSearchSlotsNotConsecutive },
  slotsNotCompetitive: { status: 409, error: ERROR.scrimSearchSlotsNotCompetitive },
  slotsNotFree: { status: 409, error: ERROR.scrimSearchSlotsNotFree },
  alreadySearching: { status: 409, error: ERROR.scrimSearchAlreadyOpen },
};

const DELETE_REFUSALS: Record<DeleteScrimSearchRefusal, { status: number; error: string }> = {
  notFound: { status: 404, error: ERROR.scrimSearchNotFound },
  notYours: { status: 403, error: ERROR.accessDenied },
  notOpen: { status: 409, error: ERROR.scrimSearchNotOpen },
};

// The slot ids as the client sends them: distinct, bounded, one at least
function readSlotIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > EVA_SLOTS_PER_MATCH_MAX) return null;
  const ids: string[] = [];
  for (const id of input) {
    if (typeof id !== 'string') return null;
    const clean = id.trim();
    if (!clean || clean.length > EVA_SLOT_ID_MAX_LENGTH || ids.includes(clean)) return null;
    ids.push(clean);
  }
  return ids;
}

// GET /api/scrims/searches?month=YYYY-MM[&venueId=] - Open searches: a venue's, or the team's own
router.get('/searches', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { month, venueId } = req.query;
  const teamId = req.account?.teamId;

  if (!isValidMonth(month)) {
    return res.status(400).json({ errors: [ERROR.monthParamRequired] });
  }
  if (venueId !== undefined && (typeof venueId !== 'string' || !venueId)) {
    return res.status(400).json({ errors: [ERROR.venueNotFound] });
  }
  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }

  try {
    const searches = await scrimSearchService.listScrimSearches({ month, venueId, teamId });
    res.json(searches);
  } catch (error) {
    apiLogger.error('Error listing scrim searches:', error);
    res.status(500).json({ errors: [ERROR.scrimSearchesFetchFailed] });
  }
});

// POST /api/scrims/searches - Put a run of slots up for an opponent
router.post('/searches', authMiddleware, requirePermission('calendar', 'canCreateEvents'), async (req: AuthRequest, res: Response) => {
  const { venueId, date, evaSlotIds } = req.body as CreateScrimSearchRequest;
  const teamId = req.account?.teamId;

  if (!teamId) {
    return res.status(403).json({ errors: [ERROR.teamRequiredForScrims] });
  }
  if (typeof venueId !== 'string' || !venueId) {
    return res.status(400).json({ errors: [ERROR.venueNotFound] });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ errors: [ERROR.dateInvalid] });
  }
  const slotIds = readSlotIds(evaSlotIds);
  if (!slotIds) {
    return res.status(400).json({ errors: [ERROR.evaSlotsInvalid] });
  }

  try {
    const result = await scrimSearchService.createScrimSearch({
      teamId,
      createdById: req.account!.playerId!,
      venueId,
      date,
      evaSlotIds: slotIds,
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

// DELETE /api/scrims/searches/:id - Withdraw one of the team's open searches
router.delete('/searches/:id', authMiddleware, requirePermission('calendar', 'canCreateEvents'), async (req: AuthRequest, res: Response) => {
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

export default router;
