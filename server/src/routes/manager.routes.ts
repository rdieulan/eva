// Venue manager routes: the venues an account manages, and the divisions of
// each one's local league as its manager arranges them

import { Router } from 'express';
import type { NextFunction, Response } from 'express';
import { authMiddleware, requireManager } from '@middleware/auth.middleware';
import type { ManagerRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import {
  getManagedVenues,
  getVenueDivisions,
  managesVenue,
  readVenueDivisions,
  saveVenueDivisions,
} from '@services/venue-divisions.service';

const router = Router();

router.use(authMiddleware, requireManager);

// Why a read of the site was refused, as an HTTP status
const READ_REFUSAL_STATUS: Record<string, number> = {
  [ERROR.divisionsReadTooSoon]: 429,
  [ERROR.divisionsMonthUnknown]: 404,
  [ERROR.divisionsMonthNotDrawn]: 404,
  [ERROR.divisionsReadFailed]: 502,
};

// Only the manager of a venue reaches it
async function requireManagedVenue(req: ManagerRequest, res: Response, next: NextFunction) {
  try {
    if (!(await managesVenue(req.managerId!, req.params.venueId as string))) {
      return res.status(403).json({ errors: [ERROR.venueNotManaged] });
    }
    next();
  } catch (error) {
    apiLogger.error('Error checking a managed venue:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
}

// GET /api/manager/venues - The venues the account manages
router.get('/venues', async (req: ManagerRequest, res: Response) => {
  try {
    res.json(await getManagedVenues(req.managerId!));
  } catch (error) {
    apiLogger.error('Error listing managed venues:', error);
    res.status(500).json({ errors: [ERROR.managedVenuesFetchFailed] });
  }
});

// GET /api/manager/venues/:venueId/divisions - The divisions of the venue's league
router.get('/venues/:venueId/divisions', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    const divisions = await getVenueDivisions(req.params.venueId as string);
    if (!divisions) return res.status(404).json({ errors: [ERROR.venueNotFound] });
    res.json(divisions);
  } catch (error) {
    apiLogger.error('Error reading divisions:', error);
    res.status(500).json({ errors: [ERROR.divisionsFetchFailed] });
  }
});

// PUT /api/manager/venues/:venueId/divisions - Save the divisions whole
router.put('/venues/:venueId/divisions', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  const { divisionCount, places } = req.body ?? {};
  try {
    const result = await saveVenueDivisions(req.params.venueId as string, { divisionCount, places });
    if ('error' in result) return res.status(400).json({ errors: [result.error] });
    res.json(result);
  } catch (error) {
    apiLogger.error('Error saving divisions:', error);
    res.status(500).json({ errors: [ERROR.divisionsSaveFailed] });
  }
});

// POST /api/manager/venues/:venueId/divisions/read - The divisions of the last
// month drawn on competitive.eva.gg, for the board to start from; not saved
router.post('/venues/:venueId/divisions/read', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    const result = await readVenueDivisions(req.params.venueId as string);
    if ('error' in result) {
      return res.status(READ_REFUSAL_STATUS[result.error] ?? 400).json({ errors: [result.error] });
    }
    res.json(result);
  } catch (error) {
    apiLogger.error('Error reading divisions from competitive.eva.gg:', error);
    res.status(500).json({ errors: [ERROR.divisionsReadFailed] });
  }
});

export default router;
