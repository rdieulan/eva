// @vitest-environment node
// Tests for signing in with Discord: the address of Discord's page, the code
// exchanged for the account it opens, the access token revoked once read.
// Run under Node, as the server: fetch is stubbed, Discord is never called.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DiscordOAuthError,
  discordAuthorizeUrl,
  identifyDiscordAccount,
} from '../../../server/src/integrations/discord/discord-oauth';

const CONFIG = { clientId: 'client-123', clientSecret: 'secret-456', redirectUri: 'https://scrim-calendar.test/api/auth/discord/callback' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('discordAuthorizeUrl', () => {
  it('asks Discord for the visitor\'s identity only, with the state that comes back', () => {
    const url = new URL(discordAuthorizeUrl(CONFIG, 'the-state'));

    expect(`${url.origin}${url.pathname}`).toBe('https://discord.com/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-123',
      scope: 'identify',
      redirect_uri: CONFIG.redirectUri,
      state: 'the-state',
      prompt: 'none',
    });
  });
});

describe('identifyDiscordAccount', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges the code, reads the account, then revokes the access token', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'access-1', token_type: 'Bearer', expires_in: 604800, scope: 'identify' }))
      .mockResolvedValueOnce(json({ id: '80351110224678912', username: 'raph_42', global_name: 'Raphaël', email: 'never@kept.test' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const identity = await identifyDiscordAccount(CONFIG, 'the-code');

    expect(identity).toEqual({ id: '80351110224678912', username: 'raph_42', globalName: 'Raphaël' });

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(tokenUrl).toBe('https://discord.com/api/oauth2/token');
    expect(tokenInit.method).toBe('POST');
    expect(tokenInit.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(Object.fromEntries(tokenInit.body as URLSearchParams)).toEqual({
      client_id: 'client-123',
      client_secret: 'secret-456',
      grant_type: 'authorization_code',
      code: 'the-code',
      redirect_uri: CONFIG.redirectUri,
    });

    const [userUrl, userInit] = fetchMock.mock.calls[1]!;
    expect(userUrl).toBe('https://discord.com/api/v10/users/@me');
    expect(userInit.headers).toEqual({ Authorization: 'Bearer access-1' });

    const [revokeUrl, revokeInit] = fetchMock.mock.calls[2]!;
    expect(revokeUrl).toBe('https://discord.com/api/oauth2/token/revoke');
    expect(Object.fromEntries(revokeInit.body as URLSearchParams)).toEqual({
      client_id: 'client-123',
      client_secret: 'secret-456',
      token: 'access-1',
      token_type_hint: 'access_token',
    });
  });

  it('reads a missing Discord name as none', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'access-1' }))
      .mockResolvedValueOnce(json({ id: '1', username: 'raph_42', global_name: null }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    expect((await identifyDiscordAccount(CONFIG, 'c')).globalName).toBeNull();
  });

  it('stops when Discord refuses the code, before reading anything', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400));

    await expect(identifyDiscordAccount(CONFIG, 'stale')).rejects.toBeInstanceOf(DiscordOAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses an answer that names no account, and still revokes the token', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'access-1' }))
      .mockResolvedValueOnce(json({ id: 'not-a-number', username: 'raph_42' }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(identifyDiscordAccount(CONFIG, 'c')).rejects.toBeInstanceOf(DiscordOAuthError);
    expect(fetchMock.mock.calls[2]![0]).toBe('https://discord.com/api/oauth2/token/revoke');
  });

  it('signs in all the same when the revocation fails, and says so', async () => {
    const onRevokeFailure = vi.fn();
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'access-1' }))
      .mockResolvedValueOnce(json({ id: '1', username: 'raph_42', global_name: 'Raph' }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    expect((await identifyDiscordAccount(CONFIG, 'c', onRevokeFailure)).id).toBe('1');
    expect(onRevokeFailure).toHaveBeenCalledWith(expect.any(DiscordOAuthError));
  });
});
