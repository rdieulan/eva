// Venues routes

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '@middleware/auth.middleware';
import * as venuesService from '@services/venues.service';
import * as venueSlotsService from '@services/venue-slots.service';
import type { VenueSlotsRefusal } from '@services/venue-slots.service';
import { isValidDate } from '@services/helpers/validation.helper';
import { EvaApiError } from '../integrations/eva/eva-graphql';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';

const router = Router();

// GET /api/venues - Get all venues (public list for authenticated users)
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const venues = await venuesService.getAllVenues();
    res.json(venues);
  } catch (error) {
    apiLogger.error('Error fetching venues:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/venues/:id - Get a single venue
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const venue = await venuesService.getVenueById(req.params.id);

    if (!venue) {
      res.status(404).json({ errors: [ERROR.venueNotFound] });
      return;
    }

    res.json(venue);
  } catch (error) {
    apiLogger.error('Error fetching venue:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// How each refused slot listing is answered
const VENUE_SLOTS_REFUSALS: Record<VenueSlotsRefusal, { status: number; error: string }> = {
  venueNotFound: { status: 404, error: ERROR.venueNotFound },
  venueNotOnEva: { status: 409, error: ERROR.venueNotOnEva },
};

// GET /api/venues/:id/slots?date=YYYY-MM-DD - The slots the venue runs that day, read from eva.gg
router.get('/:id/slots', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  if (!isValidDate(date)) {
    res.status(400).json({ errors: [ERROR.dateInvalid] });
    return;
  }

  let result;
  try {
    result = await venueSlotsService.getVenueSlots(req.params.id, date);
  } catch (error) {
    apiLogger.error('Error fetching venue slots:', error);
    // eva.gg refused or never answered (fetch itself fails with a TypeError); anything else is ours
    const isUpstream = error instanceof EvaApiError || error instanceof TypeError;
    res.status(isUpstream ? 502 : 500).json({ errors: [isUpstream ? ERROR.evaUnavailable : ERROR.venueSlotsFetchFailed] });
    return;
  }

  if ('refusal' in result) {
    const { status, error } = VENUE_SLOTS_REFUSALS[result.refusal];
    res.status(status).json({ errors: [error] });
    return;
  }
  res.json(result.slots);
});

export default router;
