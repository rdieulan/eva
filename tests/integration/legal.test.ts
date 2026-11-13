// Integration tests - Who publishes the app, for its legal pages: read from
// the deployment's settings, open to anyone, signed in or not

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';

afterEach(() => {
  // As the test run starts: none set (see vitest.integration.config.mts)
  process.env.PUBLISHER_NAME = '';
  process.env.PUBLISHER_EMAIL = '';
});

describe('GET /api/public/legal', () => {
  it('gives anyone the publisher the deployment sets, and nothing more', async () => {
    process.env.PUBLISHER_NAME = 'Camille Martin';
    process.env.PUBLISHER_EMAIL = 'contact@scrim-calendar.com';

    const res = await request(app).get('/api/public/legal');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publisher: { name: 'Camille Martin', email: 'contact@scrim-calendar.com' } });
  });

  it('says what the deployment left out, rather than failing', async () => {
    const res = await request(app).get('/api/public/legal');

    expect(res.status).toBe(200);
    expect(res.body.publisher).toEqual({ name: null, email: null });
  });
});
