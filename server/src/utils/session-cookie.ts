// The session cookie. Its scripts cannot read it (HttpOnly), so a script
// slipped into a page cannot carry the session away; the browser sends it with
// another site's requests only when following a link to us (SameSite=Lax),
// never with a change; in production it travels over HTTPS only, bound to this
// very host by its __Host- prefix.

import type { CookieOptions, Request, Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE = isProduction ? '__Host-session' : 'session';

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
};

/** The session token the request carries, if any */
export function readSessionCookie(req: Request): string | null {
  const value: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof value === 'string' && value !== '' ? value : null;
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
}
