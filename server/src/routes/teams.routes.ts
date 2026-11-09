// Team routes - HTTP protocol only, business logic in services

import { Router, raw } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { AccountPermissions } from '@shared/types';
import { validateTeamName, detectImageType } from '@shared/utils';
import { ERROR, TEAM_LOGO_MAX_BYTES, TEAM_LOGO_MIME_TYPES, TEAM_FAVORITE_VENUES_MAX } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as teamsService from '@services/teams.service';
import { linkTeamDiscord, unlinkTeamDiscord, type LinkTeamDiscordRefusal } from '@services/team-discord.service';

const router = Router();

// Why a creation or a link was refused, as an HTTP status
const TEAM_REFUSAL_STATUS: Record<string, number> = {
  [ERROR.leagueTeamNotFound]: 404,
  [ERROR.venueNotFound]: 404,
  [ERROR.teamNotFound]: 404,
  [ERROR.leagueTeamTaken]: 409,
};

// An optional id in a request body: absent or null, or a non-empty string
function isOptionalId(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === 'string' && value.length > 0);
}

// POST /api/teams - Create a team, the creator its leader; from a league team
// of the directory (leagueTeamId), it is linked to it and takes its logo
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, venueId, leagueTeamId } = req.body ?? {};

  const nameValid = validateTeamName(name);
  if (nameValid !== true) {
    return res.status(400).json({ errors: nameValid });
  }
  if (!isOptionalId(venueId) || !isOptionalId(leagueTeamId)) {
    return res.status(400).json({ errors: [ERROR.invalidRequest] });
  }

  try {
    const result = await teamsService.createTeam({
      name,
      venueId,
      leagueTeamId,
      leaderId: req.account!.userId,
    });

    if ('error' in result) {
      return res.status(TEAM_REFUSAL_STATUS[result.error] ?? 400).json({ errors: [result.error] });
    }

    res.status(201).json(result.team);
  } catch (error) {
    apiLogger.error('Error creating team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/teams/current - Get current user's team
router.get('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await teamsService.getTeamViewForPlayer(req.account!.playerId!);

    if (!team) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    res.json(team);
  } catch (error) {
    apiLogger.error('Error fetching team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// A favorite venues list as the client may send it: distinct ids, a handful at most
function readFavoriteVenueIds(input: unknown): { venueIds: string[] } | { error: string } {
  if (!Array.isArray(input) || input.some(id => typeof id !== 'string' || !id)) {
    return { error: ERROR.teamFavoriteVenuesInvalid };
  }
  const venueIds = [...new Set(input as string[])];
  if (venueIds.length > TEAM_FAVORITE_VENUES_MAX) {
    return { error: ERROR.teamFavoriteVenuesTooMany };
  }
  return { venueIds };
}

// PUT /api/teams/current - Update the current user's team (name, venue, favorite venues)
router.put('/current', authMiddleware, requirePermission('team', 'canManageTeam'), async (req: AuthRequest, res: Response) => {
  try {
    const team = await teamsService.getPlayerTeam(req.account!.playerId!);

    if (!team) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    const { name, venueId, favoriteVenueIds } = req.body;

    if (name !== undefined) {
      const nameValid = validateTeamName(name);
      if (nameValid !== true) {
        return res.status(400).json({ errors: nameValid });
      }
    }

    let favorites: string[] | undefined;
    if (favoriteVenueIds !== undefined) {
      const read = readFavoriteVenueIds(favoriteVenueIds);
      if ('error' in read) {
        return res.status(400).json({ errors: [read.error] });
      }
      favorites = read.venueIds;
    }

    const result = await teamsService.updateTeam(team.id, { name, venueId, favoriteVenueIds: favorites });

    if (result.error) {
      return res.status(400).json({ errors: [result.error] });
    }

    res.json(result.team);
  } catch (error) {
    apiLogger.error('Error updating team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/teams/current/members - Get team members with permissions
router.get('/current/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const team = await teamsService.getPlayerTeam(req.account!.playerId!);

    if (!team) {
      return res.status(404).json({ errors: [ERROR.teamNotFound] });
    }

    const members = await teamsService.getTeamMembers(team.id);
    res.json(members);
  } catch (error) {
    apiLogger.error('Error fetching members:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// PUT /api/teams/current/members/:memberId/permissions - Update member permissions
router.put(
  '/current/members/:memberId/permissions',
  authMiddleware,
  requirePermission('team', 'canManagePermissions'),
  async (req: AuthRequest, res: Response) => {
    const { memberId } = req.params;
    const { permissions } = req.body as { permissions: AccountPermissions };

    try {
      const result = await teamsService.updateMemberPermissions(
        req.account!.userId,
        memberId,
        permissions
      );

      if (!result.success) {
        const status = result.error?.includes('trouvé') ? 404 : 403;
        return res.status(status).json({ errors: [result.error] });
      }

      res.json({ message: 'Permissions mises à jour' });
    } catch (error) {
      apiLogger.error('Error updating permissions:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
    }
  }
);

// DELETE /api/teams/current/members/:memberId - Remove member from team
router.delete(
  '/current/members/:memberId',
  authMiddleware,
  requirePermission('team', 'canRemoveMembers'),
  async (req: AuthRequest, res: Response) => {
    const { memberId } = req.params;

    try {
      const result = await teamsService.removeMember(req.account!.userId, memberId);

      if (!result.success) {
        const status = result.error?.includes('trouvé') ? 404 : 403;
        return res.status(status).json({ errors: [result.error] });
      }

      res.json({ message: 'Membre retiré de l\'équipe' });
    } catch (error) {
      apiLogger.error('Error removing member:', error);
      res.status(500).json({ errors: [ERROR.serverError] });
    }
  }
);

// PUT /api/teams/current/leader - Hand the team over to another member (leader only)
router.put('/current/leader', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { memberId } = req.body ?? {};
  if (typeof memberId !== 'string' || memberId === '') {
    return res.status(400).json({ errors: [ERROR.memberNotFound] });
  }

  try {
    const result = await teamsService.transferLeadership(req.account!.userId, memberId);

    if (!result.success) {
      const status = result.error === ERROR.memberNotFound ? 404
        : result.error === ERROR.memberAlreadyLeader ? 400
          : 403;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({ message: 'Direction transférée' });
  } catch (error) {
    apiLogger.error('Error transferring leadership:', error);
    res.status(500).json({ errors: [ERROR.leadershipTransferFailed] });
  }
});

// DELETE /api/teams/current - Delete the team (leader only)
router.delete('/current', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await teamsService.deleteTeam(req.account!.playerId!);

    if (!result.success) {
      const status = result.error?.includes('leader') ? 403 : 404;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({ message: 'Équipe supprimée avec succès' });
  } catch (error) {
    apiLogger.error('Error deleting team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/teams/current/leave - Leave the team (for non-leader members)
router.post('/current/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await teamsService.leaveTeam(req.account!.playerId!);

    if (!result.success) {
      const status = result.error?.includes('leader') ? 403 : 404;
      return res.status(status).json({ errors: [result.error] });
    }

    res.json({ message: 'Vous avez quitté l\'équipe' });
  } catch (error) {
    apiLogger.error('Error leaving team:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// ============================================
// Logo
// ============================================

// A year: the URL changes with every upload, so a cached copy can never go stale
const LOGO_CACHE_SECONDS = 365 * 24 * 60 * 60;

// The image arrives as the raw request body, in one of the accepted formats
const logoBody = raw({ type: [...TEAM_LOGO_MIME_TYPES], limit: TEAM_LOGO_MAX_BYTES });

// GET /api/teams/:id/logo - The team's logo image. Loaded by <img>, which carries no token.
router.get('/:id/logo', async (req: Request, res: Response) => {
  try {
    const logo = await teamsService.getTeamLogo(req.params.id);
    if (!logo) {
      return res.status(404).json({ errors: [ERROR.teamLogoNotFound] });
    }
    res.set('Content-Type', logo.type);
    res.set('Cache-Control', `public, max-age=${LOGO_CACHE_SECONDS}, immutable`);
    res.send(logo.data);
  } catch (error) {
    apiLogger.error('Error fetching team logo:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// PUT /api/teams/current/logo - Replace the team's logo with the image sent as body
router.put(
  '/current/logo',
  authMiddleware,
  requirePermission('team', 'canManageTeam'),
  logoBody,
  async (req: AuthRequest, res: Response) => {
    // Only an accepted content type gets parsed into a Buffer; anything else arrives as is
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ errors: [ERROR.teamLogoTypeInvalid] });
    }

    // What the file really is, whatever the request claimed
    const type = detectImageType(new Uint8Array(req.body));
    if (!type) {
      return res.status(400).json({ errors: [ERROR.teamLogoTypeInvalid] });
    }

    try {
      const team = await teamsService.getPlayerTeam(req.account!.playerId!);
      if (!team) {
        return res.status(404).json({ errors: [ERROR.teamNotFound] });
      }

      const logoUrl = await teamsService.setTeamLogo(team.id, { data: req.body, type });
      res.json({ logoUrl });
    } catch (error) {
      apiLogger.error('Error uploading team logo:', error);
      res.status(500).json({ errors: [ERROR.teamLogoUploadFailed] });
    }
  },
);

// DELETE /api/teams/current/logo - Remove the team's logo
router.delete(
  '/current/logo',
  authMiddleware,
  requirePermission('team', 'canManageTeam'),
  async (req: AuthRequest, res: Response) => {
    try {
      const team = await teamsService.getPlayerTeam(req.account!.playerId!);
      if (!team) {
        return res.status(404).json({ errors: [ERROR.teamNotFound] });
      }

      await teamsService.clearTeamLogo(team.id);
      res.status(204).end();
    } catch (error) {
      apiLogger.error('Error removing team logo:', error);
      res.status(500).json({ errors: [ERROR.teamLogoDeleteFailed] });
    }
  },
);

// How each refused Discord channel is answered
const DISCORD_LINK_REFUSALS: Record<LinkTeamDiscordRefusal, { status: number; error: string }> = {
  webhookInvalid: { status: 400, error: ERROR.discordWebhookInvalid },
  webhookRefused: { status: 422, error: ERROR.discordWebhookRefused },
  discordUnreachable: { status: 502, error: ERROR.discordUnreachable },
};

// PUT /api/teams/current/discord - Post the team's notifications in a Discord channel, through its webhook
router.put(
  '/current/discord',
  authMiddleware,
  requirePermission('team', 'canManageTeam'),
  async (req: AuthRequest, res: Response) => {
    try {
      const team = await teamsService.getPlayerTeam(req.account!.playerId!);
      if (!team) {
        return res.status(404).json({ errors: [ERROR.teamNotFound] });
      }

      const result = await linkTeamDiscord(team.id, req.body?.webhookUrl);
      if (result.refusal) {
        const { status, error } = DISCORD_LINK_REFUSALS[result.refusal];
        return res.status(status).json({ errors: [error] });
      }
      res.json({ discord: 'linked' });
    } catch (error) {
      apiLogger.error('Error linking the team Discord channel:', error);
      res.status(500).json({ errors: [ERROR.discordLinkFailed] });
    }
  },
);

// PUT /api/teams/current/league-team - Link the team to its league team of the
// directory, or unlink it ({ leagueTeamId: null })
router.put(
  '/current/league-team',
  authMiddleware,
  requirePermission('team', 'canManageTeam'),
  async (req: AuthRequest, res: Response) => {
    const leagueTeamId = req.body?.leagueTeamId;
    if (!isOptionalId(leagueTeamId) || leagueTeamId === undefined) {
      return res.status(400).json({ errors: [ERROR.invalidRequest] });
    }

    try {
      const team = await teamsService.getPlayerTeam(req.account!.playerId!);
      if (!team) {
        return res.status(404).json({ errors: [ERROR.teamNotFound] });
      }

      const result = await teamsService.setTeamLeagueTeam(team.id, leagueTeamId);
      if ('error' in result) {
        return res.status(TEAM_REFUSAL_STATUS[result.error] ?? 400).json({ errors: [result.error] });
      }
      res.json(result);
    } catch (error) {
      apiLogger.error('Error linking the team to its league team:', error);
      res.status(500).json({ errors: [ERROR.leagueTeamLinkFailed] });
    }
  },
);

// DELETE /api/teams/current/discord - Stop posting the team's notifications on Discord
router.delete(
  '/current/discord',
  authMiddleware,
  requirePermission('team', 'canManageTeam'),
  async (req: AuthRequest, res: Response) => {
    try {
      const team = await teamsService.getPlayerTeam(req.account!.playerId!);
      if (!team) {
        return res.status(404).json({ errors: [ERROR.teamNotFound] });
      }

      await unlinkTeamDiscord(team.id);
      res.status(204).end();
    } catch (error) {
      apiLogger.error('Error unlinking the team Discord channel:', error);
      res.status(500).json({ errors: [ERROR.discordUnlinkFailed] });
    }
  },
);

// The body parser refuses an oversized image before the handler runs; answer in our words
router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error && typeof error === 'object' && (error as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ errors: [ERROR.teamLogoTooLarge] });
  }
  next(error);
});

export default router;
