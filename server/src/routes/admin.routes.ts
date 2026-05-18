// Admin routes - Venue and Manager management
// All routes require authMiddleware + requireAdmin.

import { Router, Response } from 'express';
import { authMiddleware, requireAdmin, requireAdminPermission, AuthRequest } from '@middleware/auth.middleware';
import { validateEmail, validateName } from '@shared/utils';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import type { AdminPermissions } from '@shared/types';
import * as venuesService from '@services/venues.service';
import * as managerService from '@services/manager.service';
import * as adminService from '@services/admin.service';
import * as playerService from '@services/player.service';
import * as teamsService from '@services/teams.service';

function normalizeAdminPermissions(input: unknown): AdminPermissions | null {
  if (!input || typeof input !== 'object') return null;
  const root = input as Record<string, unknown>;
  const system = root.system;
  if (!system || typeof system !== 'object') return null;
  const s = system as Record<string, unknown>;
  if (
    typeof s.canManageVenues !== 'boolean'
    || typeof s.canManageManagers !== 'boolean'
    || typeof s.canManageAdmins !== 'boolean'
    || typeof s.canViewAllData !== 'boolean'
  ) {
    return null;
  }
  return {
    system: {
      canManageVenues: s.canManageVenues,
      canManageManagers: s.canManageManagers,
      canManageAdmins: s.canManageAdmins,
      canViewAllData: s.canViewAllData,
    },
  };
}

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware, requireAdmin);

// ============================================
// Venues
// ============================================

// GET /api/admin/venues - List all venues
router.get('/venues', async (_req: AuthRequest, res: Response) => {
  try {
    const venues = await venuesService.getAllVenues();
    res.json(venues);
  } catch (error) {
    apiLogger.error('Admin: error listing venues:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/admin/venues - Create a venue
router.post(
  '/venues',
  requireAdminPermission('canManageVenues'),
  async (req: AuthRequest, res: Response) => {
    const { name, city, address, phone } = req.body ?? {};

    const errors: string[] = [];
    if (!name || typeof name !== 'string' || !name.trim()) errors.push(ERROR.venueNameRequired);
    if (!city || typeof city !== 'string' || !city.trim()) errors.push(ERROR.venueCityRequired);
    if (!address || typeof address !== 'string' || !address.trim()) errors.push(ERROR.venueAddressRequired);

    if (errors.length) return res.status(400).json({ errors });

    try {
      const venue = await venuesService.createVenue({ name, city, address, phone });
      res.status(201).json(venue);
    } catch (error) {
      apiLogger.error('Admin: error creating venue:', error);
      res.status(500).json({ errors: [ERROR.venueCreationFailed] });
    }
  },
);

// PUT /api/admin/venues/:id - Update a venue
router.put(
  '/venues/:id',
  requireAdminPermission('canManageVenues'),
  async (req: AuthRequest, res: Response) => {
    const { name, city, address, phone } = req.body ?? {};

    // At least one field must be provided
    if (name === undefined && city === undefined && address === undefined && phone === undefined) {
      return res.status(400).json({ errors: [ERROR.requiredFieldsMissing] });
    }

    const errors: string[] = [];
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) errors.push(ERROR.venueNameRequired);
    if (city !== undefined && (typeof city !== 'string' || !city.trim())) errors.push(ERROR.venueCityRequired);
    if (address !== undefined && (typeof address !== 'string' || !address.trim())) errors.push(ERROR.venueAddressRequired);

    if (errors.length) return res.status(400).json({ errors });

    try {
      const venue = await venuesService.updateVenue(req.params.id, { name, city, address, phone });
      if (!venue) return res.status(404).json({ errors: [ERROR.venueNotFound] });
      res.json(venue);
    } catch (error) {
      apiLogger.error('Admin: error updating venue:', error);
      res.status(500).json({ errors: [ERROR.venueUpdateFailed] });
    }
  },
);

// DELETE /api/admin/venues/:id - Delete a venue (affiliated teams lose venue)
router.delete(
  '/venues/:id',
  requireAdminPermission('canManageVenues'),
  async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await venuesService.deleteVenue(req.params.id);
      if (!deleted) return res.status(404).json({ errors: [ERROR.venueNotFound] });
      res.json({ message: 'Salle supprimée' });
    } catch (error) {
      apiLogger.error('Admin: error deleting venue:', error);
      res.status(500).json({ errors: [ERROR.venueDeleteFailed] });
    }
  },
);

// ============================================
// Managers
// ============================================

// GET /api/admin/managers - List all managers
router.get('/managers', async (_req: AuthRequest, res: Response) => {
  try {
    const managers = await managerService.listManagers();
    res.json(managers);
  } catch (error) {
    apiLogger.error('Admin: error listing managers:', error);
    res.status(500).json({ errors: [ERROR.managersFetchFailed] });
  }
});

// POST /api/admin/managers - Create a manager (with activation token)
router.post(
  '/managers',
  requireAdminPermission('canManageManagers'),
  async (req: AuthRequest, res: Response) => {
    const { email, name, venueIds } = req.body ?? {};

    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push(ERROR.emailAndPasswordRequired);
    } else {
      const emailValid = validateEmail(email);
      if (emailValid !== true) errors.push(...emailValid);
    }

    if (!name || typeof name !== 'string') {
      errors.push(ERROR.nameTooShort);
    } else {
      const nameValid = validateName(name);
      if (nameValid !== true) errors.push(...nameValid);
    }

    const normalizedVenueIds: string[] = Array.isArray(venueIds)
      ? venueIds.filter((v): v is string => typeof v === 'string')
      : [];
    if (venueIds !== undefined && !Array.isArray(venueIds)) {
      errors.push(ERROR.managerVenueIdsInvalid);
    }

    if (errors.length) return res.status(400).json({ errors });

    try {
      const result = await managerService.createManagerWithActivation(email, name, normalizedVenueIds);
      if ('error' in result) {
        if (result.error === 'emailExists') {
          return res.status(409).json({ errors: [ERROR.emailAlreadyUsed] });
        }
        if (result.error === 'invalidVenues') {
          return res.status(400).json({ errors: [ERROR.venueNotFound] });
        }
      } else {
        return res.status(201).json({
          manager: result.manager,
          activationToken: result.activationToken,
        });
      }
    } catch (error) {
      apiLogger.error('Admin: error creating manager:', error);
      res.status(500).json({ errors: [ERROR.managerCreationFailed] });
    }
  },
);

// PUT /api/admin/managers/:id - Replace the set of venues a manager manages
router.put(
  '/managers/:id',
  requireAdminPermission('canManageManagers'),
  async (req: AuthRequest, res: Response) => {
    const { venueIds } = req.body ?? {};

    if (!Array.isArray(venueIds) || venueIds.some(v => typeof v !== 'string')) {
      return res.status(400).json({ errors: [ERROR.managerVenueIdsInvalid] });
    }

    try {
      const result = await managerService.updateManagerVenues(req.params.id, venueIds);
      if (result === null) return res.status(404).json({ errors: [ERROR.managerNotFound] });
      if ('error' in result) return res.status(400).json({ errors: [ERROR.venueNotFound] });
      res.json(result);
    } catch (error) {
      apiLogger.error('Admin: error updating manager:', error);
      res.status(500).json({ errors: [ERROR.managerUpdateFailed] });
    }
  },
);

// DELETE /api/admin/managers/:id - Delete a manager
router.delete(
  '/managers/:id',
  requireAdminPermission('canManageManagers'),
  async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await managerService.deleteManager(req.params.id);
      if (!deleted) return res.status(404).json({ errors: [ERROR.managerNotFound] });
      res.json({ message: 'Manager supprimé' });
    } catch (error) {
      apiLogger.error('Admin: error deleting manager:', error);
      res.status(500).json({ errors: [ERROR.managerDeleteFailed] });
    }
  },
);

// ============================================
// Admins (admin-of-admins)
// ============================================

// GET /api/admin/admins - List all admins
router.get(
  '/admins',
  requireAdminPermission('canManageAdmins'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const admins = await adminService.listAdmins();
      res.json(admins);
    } catch (error) {
      apiLogger.error('Admin: error listing admins:', error);
      res.status(500).json({ errors: [ERROR.adminsFetchFailed] });
    }
  },
);

// POST /api/admin/admins - Create an admin (with activation token)
router.post(
  '/admins',
  requireAdminPermission('canManageAdmins'),
  async (req: AuthRequest, res: Response) => {
    const { email, name, permissions } = req.body ?? {};

    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
      errors.push(ERROR.emailAndPasswordRequired);
    } else {
      const emailValid = validateEmail(email);
      if (emailValid !== true) errors.push(...emailValid);
    }

    if (!name || typeof name !== 'string') {
      errors.push(ERROR.nameTooShort);
    } else {
      const nameValid = validateName(name);
      if (nameValid !== true) errors.push(...nameValid);
    }

    const normalized = normalizeAdminPermissions(permissions);
    if (!normalized) errors.push(ERROR.adminPermissionsInvalid);

    if (errors.length) return res.status(400).json({ errors });

    try {
      const result = await adminService.createAdminWithActivation(email, name, normalized!);
      if ('error' in result) {
        if (result.error === 'emailExists') {
          return res.status(409).json({ errors: [ERROR.emailAlreadyUsed] });
        }
      } else {
        return res.status(201).json({
          admin: result.admin,
          activationToken: result.activationToken,
        });
      }
    } catch (error) {
      apiLogger.error('Admin: error creating admin:', error);
      res.status(500).json({ errors: [ERROR.adminCreationFailed] });
    }
  },
);

// PUT /api/admin/admins/:id - Update an admin's permissions
router.put(
  '/admins/:id',
  requireAdminPermission('canManageAdmins'),
  async (req: AuthRequest, res: Response) => {
    const normalized = normalizeAdminPermissions(req.body?.permissions);
    if (!normalized) return res.status(400).json({ errors: [ERROR.adminPermissionsInvalid] });

    try {
      const result = await adminService.updateAdminGranularPermissions(req.params.id, normalized);
      if (result === 'notFound') return res.status(404).json({ errors: [ERROR.adminNotFound] });
      if (result === 'wouldRemoveLastSuperAdmin') {
        return res.status(409).json({ errors: [ERROR.adminCannotDemoteLastSuperAdmin] });
      }
      res.json(result);
    } catch (error) {
      apiLogger.error('Admin: error updating admin:', error);
      res.status(500).json({ errors: [ERROR.adminUpdateFailed] });
    }
  },
);

// DELETE /api/admin/admins/:id - Delete an admin
router.delete(
  '/admins/:id',
  requireAdminPermission('canManageAdmins'),
  async (req: AuthRequest, res: Response) => {
    const currentAdminId = req.account!.adminId;
    if (!currentAdminId) {
      return res.status(403).json({ errors: [ERROR.adminRequired] });
    }

    try {
      const result = await adminService.deleteAdmin(req.params.id, currentAdminId);
      if (result === 'notFound') return res.status(404).json({ errors: [ERROR.adminNotFound] });
      if (result === 'cannotDeleteSelf') {
        return res.status(409).json({ errors: [ERROR.adminCannotDeleteSelf] });
      }
      if (result === 'lastSuperAdmin') {
        return res.status(409).json({ errors: [ERROR.adminCannotRemoveLastSuperAdmin] });
      }
      res.json({ message: 'Administrateur supprimé' });
    } catch (error) {
      apiLogger.error('Admin: error deleting admin:', error);
      res.status(500).json({ errors: [ERROR.adminDeleteFailed] });
    }
  },
);

// ============================================
// Players (read-only admin view)
// ============================================

// GET /api/admin/players - List all players
router.get('/players', async (_req: AuthRequest, res: Response) => {
  try {
    const players = await playerService.listAllPlayers();
    res.json(players);
  } catch (error) {
    apiLogger.error('Admin: error listing players:', error);
    res.status(500).json({ errors: [ERROR.playersAdminFetchFailed] });
  }
});

// ============================================
// Teams (read-only admin view)
// ============================================

// GET /api/admin/teams - List all teams
router.get('/teams', async (_req: AuthRequest, res: Response) => {
  try {
    const teams = await teamsService.listAllTeams();
    res.json(teams);
  } catch (error) {
    apiLogger.error('Admin: error listing teams:', error);
    res.status(500).json({ errors: [ERROR.teamsAdminFetchFailed] });
  }
});

// GET /api/admin/teams/:id - Get team detail (members + leader + venue)
router.get('/teams/:id', async (req: AuthRequest, res: Response) => {
  try {
    const team = await teamsService.getTeamAdminDetail(req.params.id);
    if (!team) return res.status(404).json({ errors: [ERROR.teamNotFound] });
    res.json(team);
  } catch (error) {
    apiLogger.error('Admin: error fetching team detail:', error);
    res.status(500).json({ errors: [ERROR.teamsAdminFetchFailed] });
  }
});

export default router;
