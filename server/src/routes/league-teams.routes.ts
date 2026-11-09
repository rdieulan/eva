// League teams routes: the directory of the teams of competitive.eva.gg

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '@middleware/auth.middleware';
import * as leagueDirectory from '@services/league-directory.service';
import { ERROR } from '@shared/constants';
import { LEAGUE_SEARCH_MAX_LENGTH } from '@shared/constants/league.constants';
import { apiLogger } from '@utils/logger';

const router = Router();

// A year: the URL changes with each new logo, so a cached copy can never go stale
const LOGO_CACHE_SECONDS = 365 * 24 * 60 * 60;

// GET /api/league-teams?q= - The league teams whose name answers the search, best first
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  if (typeof q !== 'string' || q.length > LEAGUE_SEARCH_MAX_LENGTH) {
    return res.status(400).json({ errors: [ERROR.leagueSearchInvalid] });
  }

  try {
    res.json({ teams: await leagueDirectory.searchLeagueTeams(q) });
  } catch (error) {
    apiLogger.error('Error searching league teams:', error);
    res.status(500).json({ errors: [ERROR.leagueSearchFailed] });
  }
});

// GET /api/league-teams/:id - One league team, as a search lists it
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const leagueTeam = await leagueDirectory.getLeagueTeamSummary(req.params.id as string);
    if (!leagueTeam) {
      return res.status(404).json({ errors: [ERROR.leagueTeamNotFound] });
    }
    res.json(leagueTeam);
  } catch (error) {
    apiLogger.error('Error fetching league team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/league-teams/:id/venue - The venue of ours the league team plays its
// local league at, read from its tournaments on the site: a proposal, null when
// none of them is played at one of our venues
router.get('/:id/venue', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const leagueTeamId = req.params.id as string;
    if (!(await leagueDirectory.getLeagueTeamSummary(leagueTeamId))) {
      return res.status(404).json({ errors: [ERROR.leagueTeamNotFound] });
    }
    res.json({ proposal: await leagueDirectory.proposeLeagueTeamVenue(leagueTeamId) });
  } catch (error) {
    apiLogger.error('Error proposing a league team\'s venue:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/league-teams/:id/logo - A league team's logo, copied from the site
// the first time it shows. Signed in only: the server never fetches from the
// site on behalf of whoever asks.
router.get('/:id/logo', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const logo = await leagueDirectory.getLeagueTeamLogo(req.params.id as string);
    if (!logo) {
      return res.status(404).json({ errors: [ERROR.leagueTeamLogoNotFound] });
    }
    res.set('Content-Type', logo.type);
    res.set('Cache-Control', `private, max-age=${LOGO_CACHE_SECONDS}, immutable`);
    res.send(Buffer.from(logo.data));
  } catch (error) {
    apiLogger.error('Error fetching league team logo:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;
