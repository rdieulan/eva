// Integration tests - A session that cannot be read (the database failing)
// answers in the API's own shape, not with Express's error page

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { authHeader } from './helpers/auth';
import { ERROR } from '@shared/constants/error.constants';

vi.mock('../../server/src/services/session.service', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/src/services/session.service')>(),
  findSession: vi.fn().mockRejectedValue(new Error('database unreachable')),
}));

describe('A session lookup that fails', () => {
  it('answers a server error the client can read', async () => {
    const res = await request(app).get('/api/auth/me').set(authHeader('any-token'));

    expect(res.status).toBe(500);
    expect(res.body.errors).toEqual([ERROR.serverError]);
  });
});
