// Requests to join a team routes: a player without a team asks to join one,
// and those who may invite its members answer from the team page

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as joinRequests from '@services/join-requests.service';
import { getPlayerTeam } from '@services/teams.service';

const router = Router();

// Why a request was refused, as an HTTP status
const REQUEST_REFUSAL_STATUS: Record<string, number> = {
  [ERROR.teamNotFound]: 404,
  [ERROR.userNotFound]: 404,
  [ERROR.joinRequestNotFound]: 404,
  [ERROR.joinRequestRefusedBefore]: 403,
  [ERROR.joinRequestAlreadyPending]: 409,
  [ERROR.joinRequestPlayerTaken]: 409,
};

function refuse(res: Response, error: string) {
  return res.status(REQUEST_REFUSAL_STATUS[error] ?? 400).json({ errors: [error] });
}

// ============================================
// The player asking
// ============================================

// GET /api/join-requests/mine - The player's request: waiting, or refused and not seen yet
router.get('/join-requests/mine', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ request: await joinRequests.getMyJoinRequest(req.account!.playerId!) });
  } catch (error) {
    apiLogger.error('Error fetching the player\'s join request:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/join-requests - Ask to join a team ({ teamId })
router.post('/join-requests', authMiddleware, async (req: AuthRequest, res: Response) => {
  const teamId = req.body?.teamId;
  if (typeof teamId !== 'string' || !teamId) {
    return res.status(400).json({ errors: [ERROR.invalidRequest] });
  }

  try {
    const result = await joinRequests.requestToJoin(req.account!.playerId!, teamId);
    if ('error' in result) return refuse(res, result.error);
    res.status(201).json({ request: result.request });
  } catch (error) {
    apiLogger.error('Error sending a join request:', error);
    res.status(500).json({ errors: [ERROR.joinRequestFailed] });
  }
});

// DELETE /api/join-requests/mine - Take back the waiting request
router.delete('/join-requests/mine', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await joinRequests.cancelMyJoinRequest(req.account!.playerId!))) return refuse(res, ERROR.joinRequestNotFound);
    res.status(204).end();
  } catch (error) {
    apiLogger.error('Error cancelling a join request:', error);
    res.status(500).json({ errors: [ERROR.joinRequestCancelFailed] });
  }
});

// POST /api/join-requests/mine/seen - The player saw the refusal: it is not shown again
router.post('/join-requests/mine/seen', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await joinRequests.markMyRefusalsSeen(req.account!.playerId!);
    res.status(204).end();
  } catch (error) {
    apiLogger.error('Error marking a refusal seen:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// ============================================
// The team answering
// ============================================

// GET /api/teams/current/join-requests - The requests waiting for the team's answer
router.get(
  '/teams/current/join-requests',
  authMiddleware,
  requirePermission('team', 'canInviteMembers'),
  async (req: AuthRequest, res: Response) => {
    try {
      const team = await getPlayerTeam(req.account!.playerId!);
      if (!team) return refuse(res, ERROR.teamNotFound);
      res.json({ requests: await joinRequests.listTeamJoinRequests(team.id) });
    } catch (error) {
      apiLogger.error('Error fetching the team\'s join requests:', error);
      res.status(500).json({ errors: [ERROR.joinRequestsFetchFailed] });
    }
  },
);

// POST /api/teams/current/join-requests/:id/accept - Let the player in
router.post(
  '/teams/current/join-requests/:id/accept',
  authMiddleware,
  requirePermission('team', 'canInviteMembers'),
  async (req: AuthRequest, res: Response) => {
    try {
      const team = await getPlayerTeam(req.account!.playerId!);
      if (!team) return refuse(res, ERROR.teamNotFound);
      const result = await joinRequests.acceptJoinRequest(team.id, req.params.id as string);
      if ('error' in result) return refuse(res, result.error);
      res.status(204).end();
    } catch (error) {
      apiLogger.error('Error accepting a join request:', error);
      res.status(500).json({ errors: [ERROR.joinRequestAnswerFailed] });
    }
  },
);

// POST /api/teams/current/join-requests/:id/refuse - Say no to the player
router.post(
  '/teams/current/join-requests/:id/refuse',
  authMiddleware,
  requirePermission('team', 'canInviteMembers'),
  async (req: AuthRequest, res: Response) => {
    try {
      const team = await getPlayerTeam(req.account!.playerId!);
      if (!team) return refuse(res, ERROR.teamNotFound);
      if (!(await joinRequests.refuseJoinRequest(team.id, req.params.id as string))) return refuse(res, ERROR.joinRequestNotFound);
      res.status(204).end();
    } catch (error) {
      apiLogger.error('Error refusing a join request:', error);
      res.status(500).json({ errors: [ERROR.joinRequestAnswerFailed] });
    }
  },
);

export default router;
