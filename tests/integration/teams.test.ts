// Integration tests - Teams routes

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createUserWithTeam, authHeader } from './helpers/auth';
import { prisma, expectNoRecordCreated } from './helpers/db';
import { TEAM_NAME_MIN_LENGTH } from '@shared/constants/validation.constants';
import { TEAM_LOGO_MAX_BYTES, TEAM_FAVORITE_VENUES_MAX } from '@shared/constants/team.constants';
import { ERROR } from '@shared/constants/error.constants';
import { DEFAULT_PLAYER_PERMISSIONS } from '@shared/types';

// Valid test data based on validation rules
const VALID_TEAM_NAME = 'T'.repeat(TEAM_NAME_MIN_LENGTH);

describe('Teams API', () => {
  describe('POST /api/teams', () => {
    it('should create a team successfully', async () => {
      const { token, user } = await createAuthenticatedUser();

      // Count existing maps to know how many game plans should be created
      const mapCount = await prisma.map.count();

      const res = await request(app)
        .post('/api/teams')
        .set(authHeader(token))
        .send({ name: VALID_TEAM_NAME, location: 'Europe - West' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(VALID_TEAM_NAME);

      // Verify team exists in DB
      const team = await prisma.team.findUnique({ where: { id: res.body.id } });
      expect(team).not.toBeNull();
      expect(team!.name).toBe(VALID_TEAM_NAME);
      expect(team!.leaderId).toBe(user.playerId);

      // Verify player is now in the team
      const updatedPlayer = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(updatedPlayer!.teamId).toBe(res.body.id);

      // Verify default game plans were created for each map
      const gamePlans = await prisma.gamePlan.findMany({
        where: { teamId: res.body.id },
      });
      expect(gamePlans.length).toBe(mapCount);
      expect(gamePlans.every(gp => gp.name === 'Default')).toBe(true);
      expect(gamePlans.every(gp => gp.teamId === res.body.id)).toBe(true);
    });

    it('should reject without authentication', async () => {
      const res = await request(app)
        .post('/api/teams')
        .send({ name: VALID_TEAM_NAME });

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.unauthorized);
    });

    it('should reject if user already has a team', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .post('/api/teams')
        .set(authHeader(token))
        .send({ name: VALID_TEAM_NAME });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.userAlreadyInTeam);
    });
  });

  describe('GET /api/teams/current', () => {
    it('should return current team info', async () => {
      const { token, team } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/teams/current')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(team.id);
    });

    it('should identify the leader and key members by user id', async () => {
      const { token, user } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/teams/current')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.isLeader).toBe(true);
      // User id, not Player id: that is what the client session carries
      expect(res.body.leader).toEqual({ id: user.id, name: user.name });
      expect(res.body.leaderId).toBe(user.playerId);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0]).toMatchObject({ id: user.id, isLeader: true });
      expect(res.body.members[0].name).toBe(user.name);
    });

    it('should not flag a regular member as leader', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set(authHeader(leaderToken))
        .send({ expiresInHours: 24, maxUses: 1 });
      expect(inviteRes.status).toBe(201);

      const { token: memberToken } = await createAuthenticatedUser();
      await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set(authHeader(memberToken))
        .expect(200);

      const res = await request(app)
        .get('/api/teams/current')
        .set(authHeader(memberToken));

      expect(res.status).toBe(200);
      expect(res.body.isLeader).toBe(false);
      expect(res.body.members).toHaveLength(2);
    });

    it('should return 404 if user has no team', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/teams/current')
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.teamNotFound);
    });
  });

  describe('PUT /api/teams/current (favorite venues)', () => {
    // Each venue needs a public board name of its own
    let venuesMade = 0;

    async function createVenues(count: number): Promise<string[]> {
      const ids: string[] = [];
      for (let index = 0; index < count; index++) {
        venuesMade += 1;
        const venue = await prisma.venue.create({
          data: { slug: `salle-${venuesMade}`, name: `Salle ${index} ${Date.now()}`, city: 'Lyon', address: '12 rue des Lasers' },
        });
        ids.push(venue.id);
      }
      return ids;
    }

    it('should start with no favorite venue', async () => {
      const { token } = await createUserWithTeam();

      const res = await request(app)
        .get('/api/teams/current')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.favoriteVenueIds).toEqual([]);
    });

    it('should save the favorite venues in the order given and read them back', async () => {
      const { token } = await createUserWithTeam();
      const [first, second, third] = await createVenues(3);

      const res = await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ favoriteVenueIds: [third, first] });

      expect(res.status).toBe(200);
      expect(res.body.favoriteVenueIds).toEqual([third, first]);

      const read = await request(app)
        .get('/api/teams/current')
        .set(authHeader(token));
      expect(read.body.favoriteVenueIds).toEqual([third, first]);
      expect(read.body.favoriteVenueIds).not.toContain(second);
    });

    it('should replace the whole list on each save', async () => {
      const { token } = await createUserWithTeam();
      const [first, second] = await createVenues(2);

      await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ favoriteVenueIds: [first, second] })
        .expect(200);

      const res = await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ favoriteVenueIds: [second] });

      expect(res.status).toBe(200);
      expect(res.body.favoriteVenueIds).toEqual([second]);
    });

    it('should leave the favorites alone when the request does not mention them', async () => {
      const { token } = await createUserWithTeam();
      const [venueId] = await createVenues(1);

      await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ favoriteVenueIds: [venueId] })
        .expect(200);

      const res = await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ name: VALID_TEAM_NAME });

      expect(res.status).toBe(200);
      expect(res.body.favoriteVenueIds).toEqual([venueId]);
    });

    it('should drop a venue named twice', async () => {
      const { token } = await createUserWithTeam();
      const [venueId] = await createVenues(1);

      const res = await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ favoriteVenueIds: [venueId, venueId] });

      expect(res.status).toBe(200);
      expect(res.body.favoriteVenueIds).toEqual([venueId]);
    });

    it('should refuse more favorites than the limit', async () => {
      const { token } = await createUserWithTeam();
      const venueIds = await createVenues(TEAM_FAVORITE_VENUES_MAX + 1);

      const res = await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ favoriteVenueIds: venueIds });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.teamFavoriteVenuesTooMany);
    });

    it('should refuse a venue that does not exist', async () => {
      const { token } = await createUserWithTeam();
      const [venueId] = await createVenues(1);

      const res = await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ favoriteVenueIds: [venueId, 'no-such-venue'] });

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.venueNotFound);
    });

    it('should refuse anything but a list of ids', async () => {
      const { token } = await createUserWithTeam();

      for (const favoriteVenueIds of ['abc', [42], [''], { id: 'x' }]) {
        const res = await request(app)
          .put('/api/teams/current')
          .set(authHeader(token))
          .send({ favoriteVenueIds });

        expect(res.status).toBe(400);
        expect(res.body.errors).toContain(ERROR.teamFavoriteVenuesInvalid);
      }
    });

    it('should go away with the team', async () => {
      const { token, team } = await createUserWithTeam();
      const [venueId] = await createVenues(1);

      await request(app)
        .put('/api/teams/current')
        .set(authHeader(token))
        .send({ favoriteVenueIds: [venueId] })
        .expect(200);

      await request(app)
        .delete('/api/teams/current')
        .set(authHeader(token))
        .expect(200);

      expect(await prisma.teamFavoriteVenue.count({ where: { teamId: team.id } })).toBe(0);
      expect(await prisma.venue.findUnique({ where: { id: venueId } })).not.toBeNull();
    });
  });

  describe('DELETE /api/teams/current', () => {
    it('should let the leader delete their team and free its members', async () => {
      const { token: leaderToken, user: leader, team } = await createUserWithTeam();

      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set(authHeader(leaderToken))
        .send({ expiresInHours: 24, maxUses: 1 });
      expect(inviteRes.status).toBe(201);

      const { user: member, token: memberToken } = await createAuthenticatedUser();
      await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set(authHeader(memberToken))
        .expect(200);

      const res = await request(app)
        .delete('/api/teams/current')
        .set(authHeader(leaderToken));

      expect(res.status).toBe(200);
      expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull();
      expect(await prisma.gamePlan.count({ where: { teamId: team.id } })).toBe(0);

      for (const playerId of [leader.playerId!, member.playerId!]) {
        const freed = await prisma.player.findUnique({ where: { id: playerId } });
        expect(freed!.teamId).toBeNull();
        expect(freed!.permissions).toEqual(DEFAULT_PLAYER_PERMISSIONS);
      }
    });

    it('should reject a member who is not the leader', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set(authHeader(leaderToken))
        .send({ expiresInHours: 24, maxUses: 1 });
      expect(inviteRes.status).toBe(201);

      const { token: memberToken } = await createAuthenticatedUser();
      await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set(authHeader(memberToken))
        .expect(200);

      const res = await request(app)
        .delete('/api/teams/current')
        .set(authHeader(memberToken));

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.onlyLeaderCanDelete);
      expect(await prisma.team.findUnique({ where: { id: team.id } })).not.toBeNull();
    });

    it('should return 404 when the user has no team', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .delete('/api/teams/current')
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.teamNotFound);
    });
  });

  describe('POST /api/invites/:code/join', () => {
    it('should join with valid invite code', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      // Create invitation via API
      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set(authHeader(leaderToken))
        .send({ expiresInHours: 24, maxUses: 5 });

      expect(inviteRes.status).toBe(201);

      const { token: joinerToken } = await createAuthenticatedUser();

      const res = await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set(authHeader(joinerToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('teamId');
      expect(res.body).toHaveProperty('teamName');
      expect(res.body.teamId).toBe(team.id);

      // Verify invite uses incremented
      const updatedInvite = await prisma.teamInvite.findUnique({ where: { code: inviteRes.body.code } });
      expect(updatedInvite!.uses).toBe(1);
    });

    it('should reject expired invite code', async () => {
      const { user: leader, team } = await createUserWithTeam();

      // NOTE: We use Prisma directly here because we need to create an INVALID invitation
      // (expired) that cannot be created via the API
      await prisma.teamInvite.create({
        data: {
          teamId: team.id,
          createdById: leader.playerId!,
          code: 'EXPIREDCODE',
          expiresAt: new Date(Date.now() - 1000), // Already expired
          maxUses: 5,
          uses: 0,
        },
      });

      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .post('/api/invites/EXPIREDCODE/join')
        .set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.inviteExpired);
    });

    it('builds the link on the app\'s public address, whatever the headers of the request say', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();
      process.env.APP_URL = 'https://scrim.example/';
      try {
        const created = await request(app).post(`/api/teams/${team.id}/invites`).set(authHeader(leaderToken))
          .set('X-Forwarded-Host', 'evil.example').set('X-Forwarded-Proto', 'http')
          .send({ expiresInHours: 24, maxUses: 1 });
        const listed = await request(app).get(`/api/teams/${team.id}/invites`).set(authHeader(leaderToken)).set('Host', 'evil.example');

        expect(created.body.url).toBe(`https://scrim.example/join/${created.body.code}`);
        expect(listed.body.map((invite: { url: string }) => invite.url)).toEqual([created.body.url]);
      } finally {
        process.env.APP_URL = '';
      }
    });

    it('lets one player in only on a link of one use opened by two at once', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();
      const invite = await request(app).post(`/api/teams/${team.id}/invites`).set(authHeader(leaderToken)).send({ expiresInHours: 24, maxUses: 1 });
      const [first, second] = await Promise.all([createAuthenticatedUser(), createAuthenticatedUser()]);

      const answers = await Promise.all([first, second].map(({ token }) =>
        request(app).post(`/api/invites/${invite.body.code}/join`).set(authHeader(token))));

      expect(answers.map(res => res.status).sort()).toEqual([200, 400]);
      expect(answers.find(res => res.status === 400)!.body.errors).toContain(ERROR.inviteMaxUsesReached);
      expect(await prisma.player.count({ where: { teamId: team.id } })).toBe(2);
      expect((await prisma.teamInvite.findUniqueOrThrow({ where: { code: invite.body.code } })).uses).toBe(1);
    });

    it('should reject invalid invite code', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .post('/api/invites/INVALIDCODE/join')
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.inviteInvalid);
    });
  });

  describe('POST /api/teams/:teamId/invites', () => {
    it('should create an invitation link successfully', async () => {
      const { token, team, user } = await createUserWithTeam();

      // Leader has canInviteMembers by default
      const res = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set(authHeader(token))
        .send({ expiresInHours: 24, maxUses: 5 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body.maxUses).toBe(5);

      // Verify invitation exists in DB
      const invite = await prisma.teamInvite.findUnique({ where: { code: res.body.code } });
      expect(invite).not.toBeNull();
      expect(invite!.teamId).toBe(team.id);
      expect(invite!.createdById).toBe(user.playerId);
      expect(invite!.maxUses).toBe(5);
      expect(invite!.uses).toBe(0);
    });

    it('should reject without authentication', async () => {
      const { team } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .send({ expiresInHours: 24, maxUses: 1 })
      );

      expect(res.status).toBe(401);
      expect(res.body.errors).toContain(ERROR.unauthorized);
    });

    it('should reject user without canInviteMembers permission', async () => {
      const { token: leaderToken, team } = await createUserWithTeam();

      // Create a member without invite permission
      const { token: memberToken } = await createAuthenticatedUser();

      // Create invitation with leader
      const inviteRes = await request(app)
        .post(`/api/teams/${team.id}/invites`)
        .set(authHeader(leaderToken))
        .send({ expiresInHours: 24, maxUses: 1 });

      // Member joins via invite (they don't have canInviteMembers by default)
      await request(app)
        .post(`/api/invites/${inviteRes.body.code}/join`)
        .set(authHeader(memberToken));

      // Member tries to create an invite (should fail - no permission)
      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .set(authHeader(memberToken))
          .send({ expiresInHours: 24, maxUses: 1 })
      );

      expect(res.status).toBe(403);
    });

    it('should reject invalid expiresInHours', async () => {
      const { token, team } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .set(authHeader(token))
          .send({ expiresInHours: 200, maxUses: 1 }) // Max is 168
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.inviteExpirationInvalid);
    });

    it('should reject invalid maxUses', async () => {
      const { token, team } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .set(authHeader(token))
          .send({ expiresInHours: 24, maxUses: 100 }) // Max is 50
      );

      expect(res.status).toBe(400);
      expect(res.body.errors).toContain(ERROR.inviteMaxUsesInvalid);
    });

    it('should reject if user does not belong to team', async () => {
      const { team } = await createUserWithTeam();
      const { token: otherToken } = await createUserWithTeam();

      const res = await expectNoRecordCreated(
        () => prisma.teamInvite.count({ where: { teamId: team.id } }),
        () => request(app)
          .post(`/api/teams/${team.id}/invites`)
          .set(authHeader(otherToken))
          .send({ expiresInHours: 24, maxUses: 1 })
      );

      expect(res.status).toBe(403);
    });
  });
});

// ============================================
// Team logo
// ============================================
describe('Team logo API', () => {
  // The first bytes of real files: that is what the server trusts, not the declared type
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]);

  function upload(token: string, body: Buffer, type = 'image/png') {
    return request(app)
      .put('/api/teams/current/logo')
      .set(authHeader(token))
      .set('Content-Type', type)
      .send(body);
  }

  it('should store the logo and serve it back with its real type and a long cache', async () => {
    const { token, team } = await createUserWithTeam();

    const res = await upload(token, PNG);

    expect(res.status).toBe(200);
    const [path, version] = (res.body.logoUrl as string).split('?v=');
    expect(path).toBe(`/api/teams/${team.id}/logo`);
    expect(Number(version)).toBeGreaterThan(0);

    const image = await request(app).get(res.body.logoUrl);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cache-control']).toContain('immutable');
    expect(Buffer.compare(image.body as Buffer, PNG)).toBe(0);

    const current = await request(app)
      .get('/api/teams/current')
      .set(authHeader(token));
    expect(current.body.logoUrl).toBe(res.body.logoUrl);
  });

  it('should change the URL on every upload so a cached copy never lingers', async () => {
    const { token } = await createUserWithTeam();

    const first = await upload(token, PNG);
    await new Promise(resolve => setTimeout(resolve, 5));
    const second = await upload(token, PNG);

    expect(second.body.logoUrl).not.toBe(first.body.logoUrl);
  });

  it('should refuse a file that is not really a PNG, JPEG or WebP, whatever it claims', async () => {
    const { token, user } = await createUserWithTeam();

    const res = await upload(token, GIF, 'image/png');

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.teamLogoTypeInvalid);
    const team = await prisma.team.findFirst({ where: { leader: { id: user.playerId! } }, select: { logoType: true } });
    expect(team!.logoType).toBeNull();
  });

  it('should refuse a declared type a logo cannot be', async () => {
    const { token } = await createUserWithTeam();

    const res = await upload(token, GIF, 'image/gif');

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain(ERROR.teamLogoTypeInvalid);
  });

  it('should refuse an image above the size limit', async () => {
    const { token } = await createUserWithTeam();
    const huge = Buffer.concat([PNG, Buffer.alloc(TEAM_LOGO_MAX_BYTES)]);

    const res = await upload(token, huge);

    expect(res.status).toBe(413);
    expect(res.body.errors).toContain(ERROR.teamLogoTooLarge);
  });

  it('should refuse a member who cannot manage the team', async () => {
    const { token: leaderToken, team } = await createUserWithTeam();
    const member = await createAuthenticatedUser();
    const invite = await request(app)
      .post(`/api/teams/${team.id}/invites`)
      .set(authHeader(leaderToken))
      .send({ expiresInHours: 24, maxUses: 1 });
    await request(app)
      .post(`/api/invites/${invite.body.code}/join`)
      .set(authHeader(member.token))
      .expect(200);

    const res = await upload(member.token, PNG);

    expect(res.status).toBe(403);
  });

  it('should remove the logo', async () => {
    const { token, team } = await createUserWithTeam();
    const uploaded = await upload(token, PNG);

    const res = await request(app)
      .delete('/api/teams/current/logo')
      .set(authHeader(token));

    expect(res.status).toBe(204);
    const image = await request(app).get(uploaded.body.logoUrl);
    expect(image.status).toBe(404);
    const row = await prisma.team.findUnique({ where: { id: team.id }, select: { logoType: true, logoUpdatedAt: true } });
    expect(row!.logoType).toBeNull();
    expect(row!.logoUpdatedAt).toBeNull();
  });

  it('should answer 404 for a team without a logo', async () => {
    const { team } = await createUserWithTeam();

    const res = await request(app).get(`/api/teams/${team.id}/logo`);

    expect(res.status).toBe(404);
    expect(res.body.errors).toContain(ERROR.teamLogoNotFound);
  });
});
