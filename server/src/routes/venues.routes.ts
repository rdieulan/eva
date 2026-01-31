// Venues routes

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '@middleware/auth.middleware';
import * as venuesService from '@services/venues.service';
import { ERROR } from '@shared/constants';

const router = Router();

// GET /api/venues - Get all venues (public list for authenticated users)
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const venues = await venuesService.getAllVenues();
    res.json(venues);
  } catch (error) {
    console.error('[API] Error fetching venues:', error);
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
    console.error('[API] Error fetching venue:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;
