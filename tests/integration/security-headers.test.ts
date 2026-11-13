// Integration tests - The security headers every answer carries: the pages
// load only what is ours, sit in no other site's frame, and stay on HTTPS

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';

describe('Security headers', () => {
  it('let a page load only what is ours, styles and scripts written in it included', async () => {
    const res = await request(app).get('/api/health');

    const policy = res.headers['content-security-policy'];
    expect(policy.split(';').map((directive: string) => directive.trim())).toEqual([
      "default-src 'self'",
      "script-src 'self'",
      "script-src-attr 'none'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]);
  });

  it('keep the pages out of other sites\' frames, on HTTPS, and say nothing of the server', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('come with every answer, a refusal included', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});
