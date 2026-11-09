// Signing in with Discord (OAuth2, authorization code): the address that sends
// a visitor to Discord's consent page, then the code Discord sends back,
// exchanged for the account it opens. Only the "identify" scope: the account's
// number and names, never its email. The access token serves one call and is
// revoked right after: nothing is kept that could act on the account.

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const REVOKE_URL = 'https://discord.com/api/oauth2/token/revoke';
const CURRENT_USER_URL = 'https://discord.com/api/v10/users/@me';

// How long Discord has to answer each call
const ANSWER_TIMEOUT_MS = 10_000;

// A Discord account's number (a snowflake): digits only
const DISCORD_ID = /^\d{1,25}$/;

export interface DiscordOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string; // Where Discord sends the visitor back, as registered on the application
}

/** The Discord account a sign-in opened: its number and its names */
export interface DiscordIdentity {
  id: string;
  username: string; // The unique handle (2 to 32 characters)
  globalName: string | null; // The name shown on Discord, when the person set one
}

/** Discord refused or failed a call: the sign-in cannot go on */
export class DiscordOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordOAuthError';
  }
}

/**
 * The address of Discord's consent page. `state` comes back unchanged with the
 * visitor: it ties the answer to the browser that asked. Someone who already
 * agreed is not asked again (prompt=none).
 */
export function discordAuthorizeUrl(config: DiscordOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    scope: 'identify',
    redirect_uri: config.redirectUri,
    state,
    prompt: 'none',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function clientForm(config: DiscordOAuthConfig, fields: Record<string, string>): URLSearchParams {
  return new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields });
}

async function postForm(url: string, body: URLSearchParams): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
  });
}

async function exchangeCode(config: DiscordOAuthConfig, code: string): Promise<string> {
  const response = await postForm(TOKEN_URL, clientForm(config, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  }));
  if (!response.ok) throw new DiscordOAuthError(`Token exchange refused: HTTP ${response.status}`);

  const body = (await response.json()) as { access_token?: unknown };
  if (typeof body.access_token !== 'string' || body.access_token === '') {
    throw new DiscordOAuthError('Token exchange answered no access token');
  }
  return body.access_token;
}

async function fetchIdentity(accessToken: string): Promise<DiscordIdentity> {
  const response = await fetch(CURRENT_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
  });
  if (!response.ok) throw new DiscordOAuthError(`Account lookup refused: HTTP ${response.status}`);

  const body = (await response.json()) as { id?: unknown; username?: unknown; global_name?: unknown };
  if (typeof body.id !== 'string' || !DISCORD_ID.test(body.id) || typeof body.username !== 'string' || body.username === '') {
    throw new DiscordOAuthError('Account lookup answered no account');
  }
  return {
    id: body.id,
    username: body.username,
    globalName: typeof body.global_name === 'string' && body.global_name !== '' ? body.global_name : null,
  };
}

async function revokeToken(config: DiscordOAuthConfig, accessToken: string): Promise<void> {
  const response = await postForm(REVOKE_URL, clientForm(config, { token: accessToken, token_type_hint: 'access_token' }));
  if (!response.ok) throw new DiscordOAuthError(`Token revocation refused: HTTP ${response.status}`);
}

/**
 * The Discord account behind the code Discord sent back. The access token is
 * revoked once read; a revocation that fails is reported to `onRevokeFailure`
 * and changes nothing to the sign-in (the token expires on its own anyway).
 */
export async function identifyDiscordAccount(
  config: DiscordOAuthConfig,
  code: string,
  onRevokeFailure: (error: unknown) => void = () => {},
): Promise<DiscordIdentity> {
  const accessToken = await exchangeCode(config, code);
  try {
    return await fetchIdentity(accessToken);
  } finally {
    await revokeToken(config, accessToken).catch(onRevokeFailure);
  }
}
