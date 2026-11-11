// Home dashboard routes: what a player of a team has to do soon, and the read
// again at once of the team's league registration

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, getAccountPermissions, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import type { Dashboard } from '@shared/types';
import { apiLogger } from '@utils/logger';
import { getDashboard } from '@services/dashboard.service';
import { recheckTeamRegistrations } from '@services/league-registrations.service';
import { answerCompetitionOffer } from '@services/venue-competitions.service';

const router = Router();

// Why a read again was refused, as an HTTP status
const RECHECK_REFUSAL_STATUS: Record<string, number> = {
  [ERROR.leagueCheckTooSoon]: 429,
  [ERROR.leagueTeamNotLinked]: 409,
  [ERROR.leagueCheckFailed]: 502,
};

// GET /api/dashboard - What the reader has to do soon, the most pressing first;
// nothing for an account that is no player of a team
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const account = req.account!;
  if (account.accountType !== 'player' || !account.playerId || !account.teamId) {
    const nothing: Dashboard = { items: [], next: null };
    return res.json(nothing);
  }

  try {
    const permissions = await getAccountPermissions(account.userId, account.accountType);
    res.json(await getDashboard({ playerId: account.playerId, teamId: account.teamId, permissions }));
  } catch (error) {
    apiLogger.error('Error building the dashboard:', error);
    res.status(500).json({ errors: [ERROR.dashboardFetchFailed] });
  }
});

// POST /api/dashboard/league-registration/check - Read the team's league
// registration again at once, once the team is registered on the site
router.post(
  '/league-registration/check',
  authMiddleware,
  requirePermission('team', 'canManageTeam'),
  async (req: AuthRequest, res: Response) => {
    const teamId = req.account!.teamId;
    if (!teamId) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    try {
      const result = await recheckTeamRegistrations(teamId);
      if ('error' in result) {
        return res.status(RECHECK_REFUSAL_STATUS[result.error] ?? 400).json({ errors: [result.error] });
      }
      res.json(result);
    } catch (error) {
      apiLogger.error('Error reading the team\'s league registration again:', error);
      res.status(500).json({ errors: [ERROR.leagueCheckFailed] });
    }
  },
);

// POST /api/dashboard/competition-offers/:competitionId/(accept|refuse) - The
// team's answer to a competition its venue published: accepted, it joins the
// team's calendar
for (const [path, answer] of [['accept', 'ACCEPTED'], ['refuse', 'REFUSED']] as const) {
  router.post(
    `/competition-offers/:competitionId/${path}`,
    authMiddleware,
    requirePermission('calendar', 'canCreateEvents'),
    async (req: AuthRequest, res: Response) => {
      const { teamId, playerId } = req.account!;
      if (!teamId || !playerId) return res.status(404).json({ errors: [ERROR.teamNotFound] });
      try {
        const result = await answerCompetitionOffer(teamId, playerId, req.params.competitionId as string, answer);
        if ('error' in result) return res.status(404).json({ errors: [result.error] });
        res.json(result);
      } catch (error) {
        apiLogger.error('Error answering a venue competition:', error);
        res.status(500).json({ errors: [ERROR.competitionOfferFailed] });
      }
    },
  );
}

export default router;
