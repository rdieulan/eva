// Integration tests - One address for the app: a request on any other address
// the server answers on goes to the app's own, its path and query kept, but
// for Railway's health check, answered where it comes

import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { canonicalHost } from '../../server/src/middleware/canonical-host.middleware';

// The middleware as the production server mounts it, behind Railway's proxy
const server = express()
  .set('trust proxy', 1)
  .use(canonicalHost)
  .use((_req, res) => {
    res.status(200).send('served');
  });

const APP = 'https://scrim-calendar.com';

afterEach(() => {
  process.env.APP_URL = '';
});

describe('One address for the app', () => {
  it('sends a page asked on another address to the app\'s, its path and query kept, for good', async () => {
    process.env.APP_URL = `${APP}/`;

    for (const host of ['eva-calendar.com', 'www.scrim-calendar.com', 'eva.up.railway.app']) {
      const res = await request(server).get('/calendar?mode=matchmaking').set('Host', host);

      expect(res.status).toBe(301);
      expect(res.headers.location).toBe(`${APP}/calendar?mode=matchmaking`);
    }
  });

  it('keeps the method of a change, sent to the same place', async () => {
    process.env.APP_URL = APP;

    const res = await request(server).post('/api/scrims/searches').set('Host', 'eva-calendar.com').send({});

    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(`${APP}/api/scrims/searches`);
  });

  it('serves the app\'s own address, whatever its case', async () => {
    process.env.APP_URL = APP;

    for (const host of ['scrim-calendar.com', 'Scrim-Calendar.com']) {
      const res = await request(server).get('/team').set('Host', host);
      expect(res.status).toBe(200);
    }
  });

  it('never sends a request elsewhere than the app\'s address, whatever its path', async () => {
    process.env.APP_URL = APP;

    const res = await request(server).get('//evil.example/steal').set('Host', 'eva-calendar.com');

    expect(res.status).toBe(301);
    expect(new URL(res.headers.location).origin).toBe(APP);
  });

  it('answers Railway\'s health check on its own address', async () => {
    process.env.APP_URL = APP;

    const res = await request(server).get('/api/health').set('Host', 'healthcheck.railway.app');

    expect(res.status).toBe(200);
  });

  it('serves every address while the app\'s is not set', async () => {
    const res = await request(server).get('/calendar').set('Host', 'eva-calendar.com');

    expect(res.status).toBe(200);
  });
});
