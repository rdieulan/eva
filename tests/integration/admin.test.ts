// Integration tests - Admin routes (venues + managers CRUD)

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { prisma } from './helpers/db';
import { createAuthenticatedUser, createAuthenticatedAdmin, createTeamMember, createUserWithTeam, authHeader } from './helpers/auth';
import { ERROR } from '@shared/constants/error.constants';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';
import { acceptInvitation } from '../../server/src/services/invitation.service';
import { openSession } from '../../server/src/services/session.service';

// Someone accepting an invitation, as their sign-in with Discord does: a new
// person whose account takes the role, and a session acting as it
async function acceptAs(activationToken: string) {
  const { user } = await createAuthenticatedUser();
  const role = await acceptInvitation(activationToken, user.id);
  if (role !== 'MANAGER' && role !== 'ADMIN') throw new Error(`Invitation not accepted: ${role}`);
  const { token } = await openSession(user.id, role);
  return { user, token };
}

// Venues made here each need a public board name of their own
let venuesMade = 0;

async function createTestVenue(overrides: Partial<{ name: string; city: string; address: string; phone: string }> = {}) {
  venuesMade += 1;
  return prisma.venue.create({
    data: {
      slug: `venue-${venuesMade}`,
      name: overrides.name ?? `Venue ${Date.now()}`,
      city: overrides.city ?? 'Paris',
      address: overrides.address ?? '1 rue de la VR',
      phone: overrides.phone ?? null,
    },
  });
}

describe('Admin API', () => {
  // ============================================
  // Venues
  // ============================================
  describe('GET /api/admin/venues', () => {
    it('returns the list of venues for an admin', async () => {
      const { token } = await createAuthenticatedAdmin();
      await createTestVenue({ name: 'Salle A' });
      await createTestVenue({ name: 'Salle B' });

      const res = await request(app)
        .get('/api/admin/venues')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('rejects without authentication', async () => {
      const res = await request(app).get('/api/admin/venues');
      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.unauthorized);
    });

    it('rejects a non-admin account (player)', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/admin/venues')
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.adminRequired);
    });
  });

  describe('POST /api/admin/venues', () => {
    it('creates a venue', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/venues')
        .set(authHeader(token))
        .send({
          name: 'EVA Lyon',
          city: 'Lyon',
          address: '5 rue du Lac',
          phone: '+33 4 00 00 00 00',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('EVA Lyon');
      expect(res.body.id).toBeDefined();

      const persisted = await prisma.venue.findUnique({ where: { id: res.body.id } });
      expect(persisted).not.toBeNull();
      expect(persisted!.city).toBe('Lyon');
    });

    it('names the public board of a new venue after it, apart from the names already taken, for good', async () => {
      const { token } = await createAuthenticatedAdmin();
      const create = (name: string) => request(app)
        .post('/api/admin/venues')
        .set(authHeader(token))
        .send({ name, city: 'Nîmes', address: '1 rue' });

      const first = await create('Nîmes');
      const second = await create('NÎMES');
      expect(first.body.slug).toBe('nimes');
      expect(second.body.slug).toBe('nimes-2');

      // Renamed, a venue keeps the address already shared
      const renamed = await request(app)
        .put(`/api/admin/venues/${first.body.id}`)
        .set(authHeader(token))
        .send({ name: 'Nîmes Centre' });
      expect(renamed.body).toMatchObject({ name: 'Nîmes Centre', slug: 'nimes' });
    });

    it('trims whitespace and treats empty phone as null', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/venues')
        .set(authHeader(token))
        .send({ name: '  Venue Test  ', city: 'Paris', address: ' addr ', phone: '   ' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Venue Test');
      expect(res.body.address).toBe('addr');
      expect(res.body.phone).toBeNull();
    });

    it('rejects when required fields are missing', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/venues')
        .set(authHeader(token))
        .send({ name: '', city: '', address: '' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        ERROR.venueNameRequired,
        ERROR.venueCityRequired,
        ERROR.venueAddressRequired,
      ]));
    });

    it('rejects a non-admin account', async () => {
      const { token } = await createAuthenticatedUser();
      const res = await request(app)
        .post('/api/admin/venues')
        .set(authHeader(token))
        .send({ name: 'X', city: 'Y', address: 'Z' });
      expect(res.status).toBe(403);
    });

    it('rejects an admin without canManageVenues permission', async () => {
      const { token } = await createAuthenticatedAdmin({
        permissions: {
          system: {
            canManageVenues: false,
            canManageManagers: true,
            canManageAdmins: false,
            canViewAllData: true,
          },
        },
      });

      const res = await request(app)
        .post('/api/admin/venues')
        .set(authHeader(token))
        .send({ name: 'X', city: 'Y', address: 'Z' });

      expect(res.status).toBe(403);
    });
  });

  describe('venue links', () => {
    it('stores the links of a venue, trimmed, and clears the blank ones', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/venues')
        .set(authHeader(token))
        .send({
          name: 'EVA Nîmes',
          city: 'Nîmes',
          address: '400 av Claude Baillet',
          discord: ' https://discord.gg/evanimes ',
          website: '',
        });

      expect(res.status).toBe(201);
      expect(res.body.discord).toBe('https://discord.gg/evanimes');
      expect(res.body.website).toBeNull();
      expect(res.body.instagram).toBeNull();

      const persisted = await prisma.venue.findUnique({ where: { id: res.body.id } });
      expect(persisted!.discord).toBe('https://discord.gg/evanimes');
    });

    it('refuses a link that is not a web address', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/venues')
        .set(authHeader(token))
        .send({ name: 'EVA Nîmes', city: 'Nîmes', address: 'addr', discord: 'evanimes' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.venueLinkInvalid);
    });

    it('updates a single link and clears it with an empty value', async () => {
      const { token } = await createAuthenticatedAdmin();
      const venue = await createTestVenue();

      const set = await request(app)
        .put(`/api/admin/venues/${venue.id}`)
        .set(authHeader(token))
        .send({ twitch: 'https://www.twitch.tv/evanimes' });
      expect(set.status).toBe(200);
      expect(set.body.twitch).toBe('https://www.twitch.tv/evanimes');

      const clear = await request(app)
        .put(`/api/admin/venues/${venue.id}`)
        .set(authHeader(token))
        .send({ twitch: '' });
      expect(clear.status).toBe(200);
      expect(clear.body.twitch).toBeNull();
    });
  });

  describe('PUT /api/admin/venues/:id', () => {
    it('updates a venue', async () => {
      const { token } = await createAuthenticatedAdmin();
      const venue = await createTestVenue({ name: 'Old', city: 'Paris' });

      const res = await request(app)
        .put(`/api/admin/venues/${venue.id}`)
        .set(authHeader(token))
        .send({ name: 'New' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New');
      expect(res.body.city).toBe('Paris');
    });

    it('returns 404 when the venue does not exist', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .put('/api/admin/venues/non-existent')
        .set(authHeader(token))
        .send({ name: 'Hello' });

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.venueNotFound);
    });

    it('rejects when no fields are provided', async () => {
      const { token } = await createAuthenticatedAdmin();
      const venue = await createTestVenue();

      const res = await request(app)
        .put(`/api/admin/venues/${venue.id}`)
        .set(authHeader(token))
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/venues/:id', () => {
    it('deletes a venue and nulls affiliated teams', async () => {
      const { token } = await createAuthenticatedAdmin();
      const venue = await createTestVenue();

      // Create a player + team affiliated to this venue
      const player = await prisma.player.create({ data: {} });
      const team = await prisma.team.create({
        data: { name: 'Team X', leaderId: player.id, venueId: venue.id },
      });

      const res = await request(app)
        .delete(`/api/admin/venues/${venue.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);

      const deletedVenue = await prisma.venue.findUnique({ where: { id: venue.id } });
      expect(deletedVenue).toBeNull();

      const refreshedTeam = await prisma.team.findUnique({ where: { id: team.id } });
      expect(refreshedTeam!.venueId).toBeNull();
    });

    it('keeps the matches played there, without a venue', async () => {
      const { token } = await createAuthenticatedAdmin();
      const venue = await createTestVenue();

      const player = await prisma.player.create({ data: {} });
      const team = await prisma.team.create({
        data: { name: 'Team X', leaderId: player.id, venueId: venue.id },
      });
      const match = await prisma.calendarEvent.create({
        data: {
          date: new Date('2026-12-15T00:00:00.000Z'),
          startTime: '20:00',
          endTime: '22:00',
          type: 'MATCH',
          title: 'Match vs TeamY',
          teamId: team.id,
          venueId: venue.id,
          createdById: player.id,
        },
      });

      const res = await request(app)
        .delete(`/api/admin/venues/${venue.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);

      const refreshedMatch = await prisma.calendarEvent.findUnique({ where: { id: match.id } });
      expect(refreshedMatch).not.toBeNull();
      expect(refreshedMatch!.venueId).toBeNull();
    });

    it('returns 404 when the venue does not exist', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .delete('/api/admin/venues/non-existent')
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // Managers
  // ============================================
  describe('GET /api/admin/managers', () => {
    it('returns the managers and the invitations not yet accepted', async () => {
      const { token } = await createAuthenticatedAdmin();
      const venue = await createTestVenue();

      await request(app)
        .post('/api/admin/managers')
        .set(authHeader(token))
        .send({ name: 'Jean de Nîmes', venueIds: [venue.id] });

      const res = await request(app)
        .get('/api/admin/managers')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toMatchObject({ name: 'Jean de Nîmes', userId: null, activationPending: true });
      expect(res.body[0].venues).toHaveLength(1);
    });

    it('shows the link of a pending invitation only to an admin who may manage managers', async () => {
      const { token } = await createAuthenticatedAdmin();
      await request(app).post('/api/admin/managers').set(authHeader(token)).send({ name: 'Jean', venueIds: [] }).expect(201);
      const { token: viewer } = await createAuthenticatedAdmin({
        permissions: { system: { canManageVenues: true, canManageManagers: false, canManageAdmins: false, canViewAllData: true } },
      });

      const allowed = await request(app).get('/api/admin/managers').set(authHeader(token));
      const viewing = await request(app).get('/api/admin/managers').set(authHeader(viewer));

      expect(allowed.body[0].activationToken).toEqual(expect.any(String));
      expect(viewing.status).toBe(200);
      expect(viewing.body[0]).toMatchObject({ name: 'Jean', activationPending: true, activationToken: null });
    });

    it('rejects without admin role', async () => {
      const { token } = await createAuthenticatedUser();
      const res = await request(app)
        .get('/api/admin/managers')
        .set(authHeader(token));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/managers', () => {
    it('invites a manager of venues, whose link gives the role to whoever accepts it', async () => {
      const { token } = await createAuthenticatedAdmin();
      const v1 = await createTestVenue({ name: 'V1' });
      const v2 = await createTestVenue({ name: 'V2' });

      const res = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(token))
        .send({ name: '  Jean   de Nîmes ', venueIds: [v1.id, v2.id] });

      expect(res.status).toBe(201);
      expect(res.body.activationToken).toBeDefined();
      expect(res.body.manager).toMatchObject({ name: 'Jean de Nîmes', userId: null, activationPending: true });
      expect(res.body.manager.venues).toHaveLength(2);

      const manager = await acceptAs(res.body.activationToken);
      const me = await request(app).get('/api/auth/me').set(authHeader(manager.token));
      expect(me.body.account).toMatchObject({ accountType: 'manager', roles: ['player', 'manager'] });
      expect([...me.body.account.managedVenueIds].sort()).toEqual([v1.id, v2.id].sort());

      // Accepted: the list shows the person, no link any more
      const list = await request(app).get('/api/admin/managers').set(authHeader(token));
      expect(list.body[0]).toMatchObject({ userId: manager.user.id, name: manager.user.name, activationPending: false, activationToken: null });
    });

    it('invites a manager without venues', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(token))
        .send({ name: 'Mgrname', venueIds: [] });

      expect(res.status).toBe(201);
      expect(res.body.manager.venues).toHaveLength(0);
    });

    it('rejects an unknown venue id', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(token))
        .send({ name: 'Mgrname', venueIds: ['nope'] });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.venueNotFound);
    });

    it('asks who the invitation is for, as a name', async () => {
      const { token } = await createAuthenticatedAdmin();

      const missing = await request(app).post('/api/admin/managers').set(authHeader(token)).send({ venueIds: [] });
      expect(missing.status).toBe(400);
      expect(missing.body.errors).toContain(ERROR.invitedNameRequired);

      const tooShort = await request(app).post('/api/admin/managers').set(authHeader(token)).send({ name: 'a', venueIds: [] });
      expect(tooShort.status).toBe(400);
      expect(tooShort.body.errors).toContain(ERROR.nameTooShort);
    });

    it('rejects an admin without canManageManagers permission', async () => {
      const { token } = await createAuthenticatedAdmin({
        permissions: {
          system: {
            canManageVenues: true,
            canManageManagers: false,
            canManageAdmins: false,
            canViewAllData: true,
          },
        },
      });

      const res = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(token))
        .send({ name: 'Mgrname', venueIds: [] });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/managers/:id', () => {
    it('replaces the set of venues', async () => {
      const { token } = await createAuthenticatedAdmin();
      const v1 = await createTestVenue();
      const v2 = await createTestVenue();
      const v3 = await createTestVenue();

      const created = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(token))
        .send({ name: 'Mgrname', venueIds: [v1.id, v2.id] });

      const res = await request(app)
        .put(`/api/admin/managers/${created.body.manager.id}`)
        .set(authHeader(token))
        .send({ venueIds: [v3.id] });

      expect(res.status).toBe(200);
      expect(res.body.venues.map((v: { id: string }) => v.id)).toEqual([v3.id]);
    });

    it('returns 404 when the manager does not exist', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .put('/api/admin/managers/non-existent')
        .set(authHeader(token))
        .send({ venueIds: [] });

      expect(res.status).toBe(404);
    });

    it('rejects an invalid venueIds payload', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .put('/api/admin/managers/anything')
        .set(authHeader(token))
        .send({ venueIds: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.managerVenueIdsInvalid);
    });
  });

  describe('DELETE /api/admin/managers/:id', () => {
    it('takes the role away and keeps the person, a player again', async () => {
      const { token } = await createAuthenticatedAdmin();
      const created = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(token))
        .send({ name: 'Mgrname', venueIds: [] });
      const manager = await acceptAs(created.body.activationToken);

      const res = await request(app)
        .delete(`/api/admin/managers/${created.body.manager.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(await prisma.manager.findUnique({ where: { id: created.body.manager.id } })).toBeNull();
      const person = await prisma.user.findUniqueOrThrow({ where: { id: manager.user.id } });
      expect(person.managerId).toBeNull();
      // Their session, set to act as a manager, now acts as the player they still are
      const me = await request(app).get('/api/auth/me').set(authHeader(manager.token));
      expect(me.body.account).toMatchObject({ accountType: 'player', roles: ['player'] });
    });

    it('drops an invitation nobody accepted: its link stops working', async () => {
      const { token } = await createAuthenticatedAdmin();
      const created = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(token))
        .send({ name: 'Mgrname', venueIds: [] });

      await request(app).delete(`/api/admin/managers/${created.body.manager.id}`).set(authHeader(token)).expect(200);

      const { user } = await createAuthenticatedUser();
      expect(await acceptInvitation(created.body.activationToken, user.id)).toBe('invalid');
    });

    it('returns 404 when the manager does not exist', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .delete('/api/admin/managers/non-existent')
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // Admins (admin-of-admins)
  // ============================================
  const FULL_ADMIN_PERMISSIONS = {
    system: {
      canManageVenues: true,
      canManageManagers: true,
      canManageAdmins: true,
      canViewAllData: true,
    },
  };

  const REGULAR_ADMIN_PERMISSIONS = {
    system: {
      canManageVenues: true,
      canManageManagers: true,
      canManageAdmins: false,
      canViewAllData: true,
    },
  };

  describe('GET /api/admin/admins', () => {
    it('returns all admins for a super admin', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .get('/api/admin/admins')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].isSuperAdmin).toBe(true);
    });

    it('rejects an admin without canManageAdmins permission', async () => {
      const { token } = await createAuthenticatedAdmin({ permissions: REGULAR_ADMIN_PERMISSIONS });

      const res = await request(app)
        .get('/api/admin/admins')
        .set(authHeader(token));

      expect(res.status).toBe(403);
    });

    it('rejects a non-admin account', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/admin/admins')
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.adminRequired);
    });
  });

  describe('POST /api/admin/admins', () => {
    it('invites an admin, whose link gives the role and its permissions to whoever accepts it', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Newadmin', permissions: REGULAR_ADMIN_PERMISSIONS });

      expect(res.status).toBe(201);
      expect(res.body.activationToken).toBeDefined();
      expect(res.body.admin).toMatchObject({ name: 'Newadmin', userId: null, isSuperAdmin: false, activationPending: true });

      const admin = await acceptAs(res.body.activationToken);
      const me = await request(app).get('/api/auth/me').set(authHeader(admin.token));
      expect(me.body.account).toMatchObject({ accountType: 'admin', roles: ['player', 'admin'] });
      expect(me.body.account.adminPermissions).toEqual(REGULAR_ADMIN_PERMISSIONS);
    });

    it('asks who the invitation is for', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ permissions: FULL_ADMIN_PERMISSIONS });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.invitedNameRequired);
    });

    it('rejects malformed permissions payload', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Newadmin', permissions: { foo: 'bar' } });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.adminPermissionsInvalid);
    });

    it('rejects an admin without canManageAdmins', async () => {
      const { token } = await createAuthenticatedAdmin({ permissions: REGULAR_ADMIN_PERMISSIONS });

      const res = await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Newadmin', permissions: FULL_ADMIN_PERMISSIONS });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/admins/:id', () => {
    it('updates permissions', async () => {
      const { token } = await createAuthenticatedAdmin();

      const created = await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Newadmin', permissions: REGULAR_ADMIN_PERMISSIONS });
      expect(created.status).toBe(201);

      const updated = await request(app)
        .put(`/api/admin/admins/${created.body.admin.id}`)
        .set(authHeader(token))
        .send({
          permissions: {
            system: {
              canManageVenues: false,
              canManageManagers: false,
              canManageAdmins: false,
              canViewAllData: true,
            },
          },
        });

      expect(updated.status).toBe(200);
      expect(updated.body.permissions.system.canManageVenues).toBe(false);
    });

    it('refuses to demote the last super admin', async () => {
      const { token, adminId } = await createAuthenticatedAdmin();

      const res = await request(app)
        .put(`/api/admin/admins/${adminId}`)
        .set(authHeader(token))
        .send({ permissions: REGULAR_ADMIN_PERMISSIONS });

      expect(res.status).toBe(409);
      expect(res.body.errors).toContain(ERROR.adminCannotDemoteLastSuperAdmin);
    });

    it('does not count an invitation nobody accepted as another super admin', async () => {
      const { token, adminId } = await createAuthenticatedAdmin();
      await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Pending', permissions: FULL_ADMIN_PERMISSIONS })
        .expect(201);

      const res = await request(app)
        .put(`/api/admin/admins/${adminId}`)
        .set(authHeader(token))
        .send({ permissions: REGULAR_ADMIN_PERMISSIONS });

      expect(res.status).toBe(409);
    });

    it('allows demoting a super admin when another super admin exists', async () => {
      const { token } = await createAuthenticatedAdmin();

      // A second super admin, who accepted the invitation
      const second = await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Othersuper', permissions: FULL_ADMIN_PERMISSIONS });
      expect(second.status).toBe(201);
      await acceptAs(second.body.activationToken);

      // Demote it — that works because there's still 1 super admin (the caller)
      const res = await request(app)
        .put(`/api/admin/admins/${second.body.admin.id}`)
        .set(authHeader(token))
        .send({ permissions: REGULAR_ADMIN_PERMISSIONS });

      expect(res.status).toBe(200);
      expect(res.body.isSuperAdmin).toBe(false);
    });

    it('returns 404 when the admin does not exist', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .put('/api/admin/admins/non-existent')
        .set(authHeader(token))
        .send({ permissions: FULL_ADMIN_PERMISSIONS });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/admins/:id', () => {
    it('takes the role away and keeps the person, a player again', async () => {
      const { token } = await createAuthenticatedAdmin();
      const created = await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Newadmin', permissions: REGULAR_ADMIN_PERMISSIONS });
      const admin = await acceptAs(created.body.activationToken);

      const res = await request(app)
        .delete(`/api/admin/admins/${created.body.admin.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(await prisma.admin.findUnique({ where: { id: created.body.admin.id } })).toBeNull();
      const person = await prisma.user.findUniqueOrThrow({ where: { id: admin.user.id } });
      expect(person.adminId).toBeNull();
      // Their session no longer reaches the administration
      const venues = await request(app).get('/api/admin/venues').set(authHeader(admin.token));
      expect(venues.status).toBe(403);
    });

    it('refuses to delete self', async () => {
      const { token, adminId } = await createAuthenticatedAdmin();

      const res = await request(app)
        .delete(`/api/admin/admins/${adminId}`)
        .set(authHeader(token));

      expect(res.status).toBe(409);
      expect(res.body.errors).toContain(ERROR.adminCannotDeleteSelf);
    });

    it('refuses to take the role from the last super admin, an invitation never accepted not counting', async () => {
      const { adminId: onlySuperAdmin } = await createAuthenticatedAdmin();
      // An admin who may manage admins without being a super admin
      const { token } = await createAuthenticatedAdmin({
        permissions: { system: { canManageVenues: false, canManageManagers: false, canManageAdmins: true, canViewAllData: false } },
      });
      await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Pending', permissions: FULL_ADMIN_PERMISSIONS })
        .expect(201);

      const res = await request(app)
        .delete(`/api/admin/admins/${onlySuperAdmin}`)
        .set(authHeader(token));

      expect(res.status).toBe(409);
      expect(res.body.errors).toContain(ERROR.adminCannotRemoveLastSuperAdmin);
    });

    it('drops a super admin invitation nobody accepted', async () => {
      const { token } = await createAuthenticatedAdmin();
      const pending = await request(app)
        .post('/api/admin/admins')
        .set(authHeader(token))
        .send({ name: 'Pending', permissions: FULL_ADMIN_PERMISSIONS });

      const res = await request(app)
        .delete(`/api/admin/admins/${pending.body.admin.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
    });

    it('returns 404 when the admin does not exist', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .delete('/api/admin/admins/non-existent')
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // Players (read-only)
  // ============================================
  describe('GET /api/admin/players', () => {
    it('lists all players with team data and the roles they hold', async () => {
      const { token: adminToken, user: admin } = await createAuthenticatedAdmin();
      const { team } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/admin/players')
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const leaderRow = res.body.find((p: { isLeader: boolean }) => p.isLeader);
      expect(leaderRow).toBeDefined();
      expect(leaderRow.teamId).toBe(team.id);
      expect(leaderRow.teamName).toBe(team.name);
      expect(leaderRow.roles).toEqual(['player']);
      expect(leaderRow.evaUsername).toBeNull();
      expect(res.body.find((p: { userId: string }) => p.userId === admin.id).roles).toEqual(['player', 'admin']);
    });

    it('rejects a non-admin account', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/admin/players')
        .set(authHeader(token));

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/admin/players/:id', () => {
    it('deletes a player and their user account', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { user, token } = await createAuthenticatedUser();

      const res = await request(app)
        .delete(`/api/admin/players/${user.playerId}`)
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);
      expect(await prisma.player.findUnique({ where: { id: user.playerId } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
      expect((await request(app).get('/api/auth/me').set(authHeader(token))).status).toBe(401);
    });

    it('leaves what the player made for their team with the team, only their name as its author goes', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const ours = await createUserWithTeam();
      const theirs = await createUserWithTeam();
      const member = await createTeamMember(ours.token, ours.team.id);
      const venue = await createTestVenue();
      const date = new Date('2030-06-10');
      const run = { venueId: venue.id, arenaNumber: 1, startTime: '20:00', endTime: '21:20', convocationTime: '19:50' };

      // An event, a search of their team, a proposal on another team's search, and the match it made
      const event = await prisma.calendarEvent.create({
        data: { teamId: ours.team.id, date, startTime: '18:00', endTime: '19:00', type: 'EVENT', title: 'Revue VOD', createdById: member.playerId },
      });
      const search = await prisma.scrimSearch.create({
        data: { teamId: ours.team.id, date, startTime: '20:00', endTime: '22:00', convocationTime: '19:50', createdById: member.playerId },
      });
      const theirSearch = await prisma.scrimSearch.create({
        data: { teamId: theirs.team.id, date, startTime: '20:00', endTime: '22:00', convocationTime: '19:50', status: 'MATCHED', createdById: theirs.user.playerId },
      });
      const proposal = await prisma.scrimProposal.create({
        data: { ...run, searchId: theirSearch.id, teamId: ours.team.id, evaSlotIds: ['s-2000', 's-2040'], status: 'ACCEPTED', createdById: member.playerId },
      });
      const match = { date, startTime: '20:00', endTime: '21:20', type: 'MATCH' as const, venueId: venue.id, arenaNumber: 1, scrimSearchId: theirSearch.id };
      const ourMatch = await prisma.calendarEvent.create({ data: { ...match, teamId: ours.team.id, title: 'Scrim', createdById: member.playerId } });
      const theirMatch = await prisma.calendarEvent.create({ data: { ...match, teamId: theirs.team.id, title: 'Scrim', createdById: theirs.user.playerId } });

      const res = await request(app).delete(`/api/admin/players/${member.playerId}`).set(authHeader(adminToken));

      expect(res.status).toBe(200);
      expect(await prisma.player.findUnique({ where: { id: member.playerId } })).toBeNull();
      expect(await prisma.calendarEvent.findUnique({ where: { id: event.id } })).toMatchObject({ teamId: ours.team.id, createdById: null });
      expect(await prisma.scrimSearch.findUnique({ where: { id: search.id } })).toMatchObject({ teamId: ours.team.id, createdById: null });
      expect(await prisma.scrimProposal.findUnique({ where: { id: proposal.id } })).toMatchObject({ teamId: ours.team.id, createdById: null });
      // The match stays in both calendars
      expect(await prisma.calendarEvent.findUnique({ where: { id: ourMatch.id } })).toMatchObject({ createdById: null });
      expect(await prisma.calendarEvent.findUnique({ where: { id: theirMatch.id } })).toMatchObject({ createdById: theirs.user.playerId });
    });

    it('refuses to delete a manager: that role goes from the managers\' list, under its own permission', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const created = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(adminToken))
        .send({ name: 'Mgrname', venueIds: [] });
      const manager = await acceptAs(created.body.activationToken);

      const res = await request(app).delete(`/api/admin/players/${manager.user.playerId}`).set(authHeader(adminToken));

      expect(res.status).toBe(409);
      expect(res.body.errors).toContain(ERROR.playerCannotDeleteManager);
      expect(await prisma.manager.findUnique({ where: { id: created.body.manager.id } })).not.toBeNull();
    });

    it('refuses to delete an admin: that role goes from the admins\' list, where its guards stand', async () => {
      const { token: adminToken, user: admin } = await createAuthenticatedAdmin();

      const res = await request(app)
        .delete(`/api/admin/players/${admin.playerId}`)
        .set(authHeader(adminToken));

      expect(res.status).toBe(409);
      expect(res.body.errors).toContain(ERROR.playerCannotDeleteAdmin);
    });

    it('refuses to delete a team leader', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { team, user } = await createUserWithTeam();

      const res = await request(app)
        .delete(`/api/admin/players/${user.playerId}`)
        .set(authHeader(adminToken));

      expect(res.status).toBe(409);
      expect(res.body.errors).toContain(ERROR.playerCannotDeleteLeader);

      const stillThere = await prisma.team.findUnique({ where: { id: team.id } });
      expect(stillThere).not.toBeNull();
    });

    it('returns 404 for an unknown player', async () => {
      const { token } = await createAuthenticatedAdmin();
      const res = await request(app)
        .delete('/api/admin/players/non-existent')
        .set(authHeader(token));
      expect(res.status).toBe(404);
    });

    it('rejects a non-admin account', async () => {
      const { token } = await createAuthenticatedUser();
      const res = await request(app)
        .delete('/api/admin/players/anything')
        .set(authHeader(token));
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/admin/players/:id/eva-account', () => {
    it('frees the eva.gg account a player holds, for its owner to link it', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { user, token } = await createAuthenticatedUser();
      await prisma.player.update({ where: { id: user.playerId }, data: { evaUserId: 202617, evaUsername: 'Sib#202617', evaLinkedAt: new Date() } });
      const listed = await request(app).get('/api/admin/players').set(authHeader(adminToken));
      expect(listed.body.find((p: { id: string }) => p.id === user.playerId).evaUsername).toBe('Sib#202617');

      const res = await request(app).delete(`/api/admin/players/${user.playerId}/eva-account`).set(authHeader(adminToken));

      expect(res.status).toBe(204);
      expect(await prisma.player.findUniqueOrThrow({ where: { id: user.playerId } })).toMatchObject({ evaUserId: null, evaUsername: null, evaLinkedAt: null });
      // The player freed is asked for an account again at their next visit
      expect((await request(app).get('/api/auth/me').set(authHeader(token))).body.account.hasEvaAccount).toBe(false);
    });

    it('says when there is none to free, and is for admins only', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { user, token } = await createAuthenticatedUser();

      const none = await request(app).delete(`/api/admin/players/${user.playerId}/eva-account`).set(authHeader(adminToken));
      expect(none.status).toBe(404);
      expect(none.body.errors).toContain(ERROR.evaAccountNotLinked);
      expect((await request(app).delete(`/api/admin/players/${user.playerId}/eva-account`).set(authHeader(token))).status).toBe(403);
    });
  });

  // ============================================
  // Teams
  // ============================================
  describe('GET /api/admin/teams', () => {
    it('lists all teams with summary data', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { team } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/admin/teams')
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const row = res.body.find((t: { id: string }) => t.id === team.id);
      expect(row).toBeDefined();
      expect(row.memberCount).toBe(1);
      expect(row.leader).toBeDefined();
    });
  });

  describe('GET /api/admin/teams/:id', () => {
    it('returns team detail with members', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { team, user: leader } = await createUserWithTeam();

      const res = await request(app)
        .get(`/api/admin/teams/${team.id}`)
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(team.id);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].name).toBe(leader.name);
      expect(res.body.members[0].isLeader).toBe(true);
    });

    it('returns 404 for non-existent team', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();

      const res = await request(app)
        .get('/api/admin/teams/non-existent')
        .set(authHeader(adminToken));

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/teams/:id', () => {
    it('deletes a team, frees its members and cascades its data', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { team, user: leader } = await createUserWithTeam();

      const gamePlanCount = await prisma.gamePlan.count({ where: { teamId: team.id } });
      expect(gamePlanCount).toBeGreaterThan(0);

      const res = await request(app)
        .delete(`/api/admin/teams/${team.id}`)
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);

      expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull();
      expect(await prisma.gamePlan.count({ where: { teamId: team.id } })).toBe(0);

      // The leader keeps their account, without a team and with default permissions
      const freedLeader = await prisma.player.findUnique({ where: { id: leader.playerId! } });
      expect(freedLeader).not.toBeNull();
      expect(freedLeader!.teamId).toBeNull();
      expect(freedLeader!.permissions).toEqual(DEFAULT_PLAYER_PERMISSIONS);
    });

    it('frees non-leader members too', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { token: leaderToken, team } = await createUserWithTeam();
      const { user: member, token: memberToken } = await createAuthenticatedUser();

      const invite = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set(authHeader(leaderToken))
        .send({ expiresInHours: 24, maxUses: 1 });
      expect(invite.status).toBe(201);

      const joined = await request(app)
        .post(`/api/invites/${invite.body.code}/join`)
        .set(authHeader(memberToken));
      expect(joined.status).toBe(200);

      const res = await request(app)
        .delete(`/api/admin/teams/${team.id}`)
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);

      const freedMember = await prisma.player.findUnique({ where: { id: member.playerId! } });
      expect(freedMember!.teamId).toBeNull();
    });

    it('lets the admin delete a leader once their team is gone', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const { team, user: leader } = await createUserWithTeam();

      const blocked = await request(app)
        .delete(`/api/admin/players/${leader.playerId}`)
        .set(authHeader(adminToken));
      expect(blocked.status).toBe(409);

      await request(app)
        .delete(`/api/admin/teams/${team.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      const deleted = await request(app)
        .delete(`/api/admin/players/${leader.playerId}`)
        .set(authHeader(adminToken));
      expect(deleted.status).toBe(200);
    });

    it('returns 404 for a non-existent team', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();

      const res = await request(app)
        .delete('/api/admin/teams/non-existent')
        .set(authHeader(adminToken));

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.teamNotFound);
    });

    it('rejects a non-admin account', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .delete('/api/admin/teams/anything')
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.adminRequired);
    });
  });

  // ============================================
  // Permissions / role enforcement (cross-cutting)
  // ============================================
  describe('Permissions', () => {
    it('rejects a manager account on admin routes', async () => {
      const { token: adminToken } = await createAuthenticatedAdmin();
      const created = await request(app)
        .post('/api/admin/managers')
        .set(authHeader(adminToken))
        .send({ name: 'Mgrname', venueIds: [] });
      expect(created.status).toBe(201);
      const manager = await acceptAs(created.body.activationToken);

      const res = await request(app)
        .get('/api/admin/venues')
        .set(authHeader(manager.token));
      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.adminRequired);
    });
  });
});
