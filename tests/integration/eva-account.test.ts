// Integration tests - Players routes (eva.gg account link)
//
// eva.gg is never called: the public lookup is mocked so each test decides how
// eva.gg answers.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser, createAuthenticatedAdmin, authHeader } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { EVA_USERNAME_MAX_LENGTH } from '@shared/constants/validation.constants';
import { fetchPublicPlayerByUsername } from '../../server/src/integrations/eva/eva-players';
import { EvaApiError } from '../../server/src/integrations/eva/eva-graphql';

vi.mock('../../server/src/integrations/eva/eva-players', () => ({
  fetchPublicPlayerByUsername: vi.fn(),
}));

const lookup = vi.mocked(fetchPublicPlayerByUsername);

const SIB = { userId: 202617, username: 'Sib#202617', displayName: 'Sib' };

beforeEach(() => {
  lookup.mockReset();
});

describe('eva.gg account API', () => {
  describe('GET /api/players/me/eva-account', () => {
    it('should return null for a player who linked nothing', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .get('/api/players/me/eva-account')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('should reject an account that is not a player', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .get('/api/players/me/eva-account')
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body.errors).toContain(ERROR.playerAccountRequired);
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/api/players/me/eva-account');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/players/me/eva-account', () => {
    it('should resolve the tag on eva.gg, store the account and read it back', async () => {
      const { token, user } = await createAuthenticatedUser();
      lookup.mockResolvedValue({ player: SIB });

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: '  Sib#202617 ' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ userId: 202617, username: 'Sib#202617' });
      expect(new Date(res.body.linkedAt).getTime()).not.toBeNaN();
      expect(lookup).toHaveBeenCalledWith('Sib#202617');

      const player = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(player!.evaUserId).toBe(202617);
      expect(player!.evaUsername).toBe('Sib#202617');
      expect(player!.evaLinkedAt).not.toBeNull();

      const reread = await request(app)
        .get('/api/players/me/eva-account')
        .set(authHeader(token));
      expect(reread.body).toEqual(res.body);
    });

    it('should store the tag as eva.gg spells it, not as typed', async () => {
      const { token } = await createAuthenticatedUser();
      lookup.mockResolvedValue({ player: SIB });

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'sib#202617' });

      expect(res.body.username).toBe('Sib#202617');
    });

    it('should replace a previous link with the new account', async () => {
      const { token, user } = await createAuthenticatedUser();
      lookup.mockResolvedValueOnce({ player: SIB });
      await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'Sib#202617' })
        .expect(200);

      lookup.mockResolvedValueOnce({ player: { userId: 177352, username: 'RONxSib#177352', displayName: 'RONxSib' } });
      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'RONxSib#177352' });

      expect(res.status).toBe(200);
      const player = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(player!.evaUserId).toBe(177352);
      expect(player!.evaUsername).toBe('RONxSib#177352');
    });

    it('should reject a tag nobody has and store nothing', async () => {
      const { token, user } = await createAuthenticatedUser();
      lookup.mockResolvedValue({ miss: 'notFound' });

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'Nobody#000000' });

      expect(res.status).toBe(404);
      expect(res.body.errors).toEqual([ERROR.evaPlayerNotFound]);
      const player = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(player!.evaUserId).toBeNull();
    });

    it('should tell the player when their eva.gg profile is private', async () => {
      const { token } = await createAuthenticatedUser();
      lookup.mockResolvedValue({ miss: 'privateProfile' });

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'Shy#123456' });

      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual([ERROR.evaProfilePrivate]);
    });

    it('should refuse an eva.gg account another player already linked', async () => {
      const first = await createAuthenticatedUser({ email: 'first@example.com' });
      const second = await createAuthenticatedUser({ email: 'second@example.com' });
      lookup.mockResolvedValue({ player: SIB });

      await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(first.token))
        .send({ username: 'Sib#202617' })
        .expect(200);

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(second.token))
        .send({ username: 'Sib#202617' });

      expect(res.status).toBe(409);
      expect(res.body.errors).toEqual([ERROR.evaAccountAlreadyLinked]);
      const player = await prisma.player.findUnique({ where: { id: second.user.playerId! } });
      expect(player!.evaUserId).toBeNull();
    });

    it('should let a player link the same account again', async () => {
      const { token } = await createAuthenticatedUser();
      lookup.mockResolvedValue({ player: SIB });

      await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'Sib#202617' })
        .expect(200);

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'Sib#202617' });

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(202617);
    });

    it('should reject an empty or missing tag without asking eva.gg', async () => {
      const { token } = await createAuthenticatedUser();

      for (const body of [{}, { username: '' }, { username: '   ' }, { username: 42 }]) {
        const res = await request(app)
          .put('/api/players/me/eva-account')
          .set(authHeader(token))
          .send(body);

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual([ERROR.evaUsernameRequired]);
      }
      expect(lookup).not.toHaveBeenCalled();
    });

    it('should reject a tag longer than eva.gg could have issued', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'x'.repeat(EVA_USERNAME_MAX_LENGTH + 1) });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([ERROR.evaUsernameTooLong]);
      expect(lookup).not.toHaveBeenCalled();
    });

    it('should answer 502 when eva.gg cannot be reached', async () => {
      const { token, user } = await createAuthenticatedUser();
      lookup.mockRejectedValue(new EvaApiError('eva.gg a répondu 503', [], 503));

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'Sib#202617' });

      expect(res.status).toBe(502);
      expect(res.body.errors).toEqual([ERROR.evaUnavailable]);
      const player = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(player!.evaUserId).toBeNull();
    });

    it('should reject an account that is not a player', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'Sib#202617' });

      expect(res.status).toBe(403);
      expect(lookup).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/players/me/eva-account', () => {
    it('should forget the linked account', async () => {
      const { token, user } = await createAuthenticatedUser();
      lookup.mockResolvedValue({ player: SIB });
      await request(app)
        .put('/api/players/me/eva-account')
        .set(authHeader(token))
        .send({ username: 'Sib#202617' })
        .expect(200);

      const res = await request(app)
        .delete('/api/players/me/eva-account')
        .set(authHeader(token));

      expect(res.status).toBe(204);
      const player = await prisma.player.findUnique({ where: { id: user.playerId! } });
      expect(player!.evaUserId).toBeNull();
      expect(player!.evaUsername).toBeNull();
      expect(player!.evaLinkedAt).toBeNull();

      const reread = await request(app)
        .get('/api/players/me/eva-account')
        .set(authHeader(token));
      expect(reread.body).toBeNull();
    });

    it('should succeed for a player who linked nothing', async () => {
      const { token } = await createAuthenticatedUser();

      const res = await request(app)
        .delete('/api/players/me/eva-account')
        .set(authHeader(token));

      expect(res.status).toBe(204);
    });

    it('should reject an account that is not a player', async () => {
      const { token } = await createAuthenticatedAdmin();

      const res = await request(app)
        .delete('/api/players/me/eva-account')
        .set(authHeader(token));

      expect(res.status).toBe(403);
    });
  });
});
