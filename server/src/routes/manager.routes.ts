// Venue manager routes: the venues an account manages, the settings of each
// (its public information, its Discord channel), the divisions of its local
// league as its manager arranges them, and the competitions the manager
// publishes in the venue's calendar

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
import {
  createVenueCompetition,
  deleteVenueCompetition,
  listVenueCompetitions,
} from '@services/venue-competitions.service';
import { getVenueSettings, refreshVenueFromEva } from '@services/venue-settings.service';
import { DISCORD_LINK_REFUSALS, linkDiscordChannel, unlinkDiscordChannel } from '@services/discord-channel.service';

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

// Why a read of the venue on eva.gg was refused, as an HTTP status
const REFRESH_REFUSAL_STATUS: Record<string, number> = {
  [ERROR.venueNotFound]: 404,
  [ERROR.venueNotFromEva]: 409,
  [ERROR.venueRefreshTooSoon]: 429,
  [ERROR.venueGoneFromEva]: 404,
  [ERROR.venueRefreshFailed]: 502,
};

// GET /api/manager/venues/:venueId - The venue's settings: its public information, its Discord channel
router.get('/venues/:venueId', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    const settings = await getVenueSettings(req.params.venueId as string);
    if (!settings) return res.status(404).json({ errors: [ERROR.venueNotFound] });
    res.json(settings);
  } catch (error) {
    apiLogger.error('Error reading venue settings:', error);
    res.status(500).json({ errors: [ERROR.venueSettingsFetchFailed] });
  }
});

// POST /api/manager/venues/:venueId/refresh - Read the venue again on eva.gg
router.post('/venues/:venueId/refresh', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    const result = await refreshVenueFromEva(req.params.venueId as string);
    if ('error' in result) return res.status(REFRESH_REFUSAL_STATUS[result.error] ?? 400).json({ errors: [result.error] });
    res.json(result);
  } catch (error) {
    apiLogger.error('Error reading a venue again on eva.gg:', error);
    res.status(500).json({ errors: [ERROR.venueRefreshFailed] });
  }
});

// PUT /api/manager/venues/:venueId/discord - Link a channel of the venue's own Discord, through its webhook
router.put('/venues/:venueId/discord', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    const result = await linkDiscordChannel('venue', req.params.venueId as string, req.body?.webhookUrl);
    if (result.refusal) {
      const { status, error } = DISCORD_LINK_REFUSALS[result.refusal];
      return res.status(status).json({ errors: [error] });
    }
    res.json({ discord: 'linked' });
  } catch (error) {
    apiLogger.error('Error linking the venue Discord channel:', error);
    res.status(500).json({ errors: [ERROR.discordLinkFailed] });
  }
});

// DELETE /api/manager/venues/:venueId/discord - Unlink the venue's Discord channel
router.delete('/venues/:venueId/discord', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    await unlinkDiscordChannel('venue', req.params.venueId as string);
    res.status(204).end();
  } catch (error) {
    apiLogger.error('Error unlinking the venue Discord channel:', error);
    res.status(500).json({ errors: [ERROR.discordUnlinkFailed] });
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

// GET /api/manager/venues/:venueId/competitions - The venue's competitions to come, the soonest first
router.get('/venues/:venueId/competitions', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    res.json(await listVenueCompetitions(req.params.venueId as string));
  } catch (error) {
    apiLogger.error('Error listing venue competitions:', error);
    res.status(500).json({ errors: [ERROR.competitionsFetchFailed] });
  }
});

// POST /api/manager/venues/:venueId/competitions - Publish a competition: a division's day, or a tournament of the venue
router.post('/venues/:venueId/competitions', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    const result = await createVenueCompetition(req.params.venueId as string, req.body ?? {});
    if ('error' in result) return res.status(400).json({ errors: [result.error] });
    res.status(201).json(result);
  } catch (error) {
    apiLogger.error('Error publishing a venue competition:', error);
    res.status(500).json({ errors: [ERROR.competitionSaveFailed] });
  }
});

// DELETE /api/manager/venues/:venueId/competitions/:competitionId - Withdraw a competition
router.delete('/venues/:venueId/competitions/:competitionId', requireManagedVenue, async (req: ManagerRequest, res: Response) => {
  try {
    const deleted = await deleteVenueCompetition(req.params.venueId as string, req.params.competitionId as string);
    if (!deleted) return res.status(404).json({ errors: [ERROR.competitionNotFound] });
    res.status(204).end();
  } catch (error) {
    apiLogger.error('Error withdrawing a venue competition:', error);
    res.status(500).json({ errors: [ERROR.competitionDeleteFailed] });
  }
});

export default router;
