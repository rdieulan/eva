// Public routes: what anyone can read without an account, for a venue to
// share on its own channels. Nothing here calls eva.gg.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getVenueBoard } from '@services/scrim-search.service';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';

const router = Router();

// GET /api/public/venues/:slug/board - The open searches to come in a venue
router.get('/venues/:slug/board', async (req: Request, res: Response) => {
  try {
    const board = await getVenueBoard(req.params.slug!);
    if (!board) {
      res.status(404).json({ errors: [ERROR.venueNotFound] });
      return;
    }
    res.json(board);
  } catch (error) {
    apiLogger.error('Error fetching venue board:', error);
    res.status(500).json({ errors: [ERROR.venueBoardFetchFailed] });
  }
});

export default router;
