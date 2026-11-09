// The cookies of signing in. Their scripts cannot read them (HttpOnly), so a
// script slipped into a page cannot carry them away; the browser sends them
// with another site's requests only when following a link to us
// (SameSite=Lax), never with a change: that is also what lets the sign-in
// cookie come back with the visitor Discord sends back. In production they
// travel over HTTPS only, bound to this very host by their __Host- prefix.
//
// - the session: who the requests act for (see services/session.service)
// - the sign-in: what a sign-in with Discord started, for its way back

import type { CookieOptions, Request, Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE = isProduction ? '__Host-session' : 'session';
export const SIGN_IN_COOKIE = isProduction ? '__Host-sign-in' : 'sign-in';

// The time a visitor has on Discord's page before the sign-in must start over
const SIGN_IN_TTL_MS = 10 * 60 * 1000;

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
};

function readCookie(req: Request, name: string): string | null {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : null;
}

/** The session token the request carries, if any */
export function readSessionCookie(req: Request): string | null {
  return readCookie(req, SESSION_COOKIE);
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
}

/** What a sign-in with Discord started: checked, then dropped, when the visitor comes back */
export interface SignInStart {
  state: string; // Comes back with the visitor: ties Discord's answer to this browser
  next: string; // The page of the app to land on
  invitation: string | null; // The invitation the sign-in accepts, if any
}

export function setSignInCookie(res: Response, start: SignInStart): void {
  const value = Buffer.from(JSON.stringify(start)).toString('base64url');
  res.cookie(SIGN_IN_COOKIE, value, { ...COOKIE_OPTIONS, maxAge: SIGN_IN_TTL_MS });
}

/** The sign-in this browser started, if any and readable */
export function readSignInCookie(req: Request): SignInStart | null {
  const value = readCookie(req, SIGN_IN_COOKIE);
  if (!value) return null;
  try {
    const start = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<SignInStart>;
    if (typeof start.state !== 'string' || typeof start.next !== 'string') return null;
    return {
      state: start.state,
      next: start.next,
      invitation: typeof start.invitation === 'string' ? start.invitation : null,
    };
  } catch {
    return null;
  }
}

export function clearSignInCookie(res: Response): void {
  res.clearCookie(SIGN_IN_COOKIE, COOKIE_OPTIONS);
}
