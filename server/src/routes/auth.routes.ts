// Authentication routes: signing in with Discord, the session, the role it
// acts as, the name a person shows, and the invitations to a role

import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { authMiddleware, readRequestSession, ROLE_OF_ACCOUNT_TYPE } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import { ERROR } from '@shared/constants';
import type { AccountType } from '@shared/types';
import { authLogger } from '@utils/logger';
import { getAccount, heldRoles, renameAccount } from '@services/auth.service';
import { closeSession, openSession, setSessionRole } from '@services/session.service';
import { discordLoginConfig, signInWithDiscord } from '@services/discord-login.service';
import { readInvitation } from '@services/invitation.service';
import type { InvitationError } from '@services/invitation.service';
import {
  clearSessionCookie,
  clearSignInCookie,
  readSessionCookie,
  readSignInCookie,
  setSessionCookie,
  setSignInCookie,
} from '@utils/auth-cookies';
import { discordAuthorizeUrl, identifyDiscordAccount } from '../integrations/discord/discord-oauth';

const router = Router();

// A page of the app to land on after signing in: a path of ours, nothing else
// (no other site, no address starting with // or a backslash, no API route)
const NEXT_MAX_LENGTH = 500;

function safeNext(input: unknown): string {
  if (typeof input !== 'string' || input.length > NEXT_MAX_LENGTH) return '/';
  if (!input.startsWith('/') || input.startsWith('//') || input.includes('\\') || /[\u0000-\u001f]/.test(input)) return '/';
  if (input === '/api' || input.startsWith('/api/')) return '/';
  return input;
}

// An invitation's token, as invitation.service makes them (a UUID)
const INVITATION_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Why a sign-in stops, as the login page reads it from its address
type SignInProblem = 'cancelled' | 'expired' | 'failed' | 'unavailable';

// The page that tells a sign-in stopped: the login page, which can start again
// towards the same page; the invitation's own page when an invitation failed
function signInProblemPage(problem: SignInProblem, next: string): string {
  const query = new URLSearchParams({ error: problem, ...(next !== '/' && { redirect: next }) });
  return `/login?${query.toString()}`;
}

const INVITATION_PROBLEMS: Record<InvitationError, string> = {
  invalid: 'invitation-invalid',
  expired: 'invitation-expired',
  roleTaken: 'role-taken',
};

function invitationProblemPage(error: InvitationError, invitation: string): string {
  return `/activate/${encodeURIComponent(invitation)}?error=${INVITATION_PROBLEMS[error]}`;
}

// GET /api/auth/discord - Start signing in: off to Discord's consent page.
// ?next= the page to land on, ?invitation= the invitation to accept.
router.get('/discord', (req: Request, res: Response) => {
  const next = safeNext(req.query.next);
  const config = discordLoginConfig();
  if (!config) {
    authLogger.error('Discord sign-in asked for, but DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET or APP_URL is missing');
    return res.redirect(signInProblemPage('unavailable', next));
  }

  const invitation = typeof req.query.invitation === 'string' && req.query.invitation !== '' ? req.query.invitation : null;
  if (invitation !== null && !INVITATION_TOKEN.test(invitation)) {
    return res.redirect(invitationProblemPage('invalid', invitation));
  }

  const state = randomBytes(32).toString('base64url');
  setSignInCookie(res, { state, next, invitation });
  res.redirect(discordAuthorizeUrl(config, state));
});

// GET /api/auth/discord/callback - Discord sends the visitor back here, with
// a code to exchange or the reason it has none. The state ties it to the
// browser that started: without it, anyone could sign a visitor into their own account.
router.get('/discord/callback', async (req: Request, res: Response) => {
  const start = readSignInCookie(req);
  clearSignInCookie(res);

  // Written by this server, but read as any input: checked again
  const next = safeNext(start?.next);
  const invitation = start?.invitation && INVITATION_TOKEN.test(start.invitation) ? start.invitation : null;

  const { state, code, error } = req.query;
  if (!start || typeof state !== 'string' || !sameSecret(state, start.state)) {
    return res.redirect(signInProblemPage('expired', next));
  }
  if (error === 'access_denied') return res.redirect(signInProblemPage('cancelled', next));
  if (typeof code !== 'string' || code === '') return res.redirect(signInProblemPage('failed', next));

  const config = discordLoginConfig();
  if (!config) return res.redirect(signInProblemPage('unavailable', next));

  try {
    const identity = await identifyDiscordAccount(config, code, revokeError => {
      authLogger.warn('Discord access token not revoked:', revokeError);
    });

    const outcome = await signInWithDiscord(identity, invitation);
    if ('error' in outcome) return res.redirect(invitationProblemPage(outcome.error, invitation!));

    // The session this browser held, if any, ends with the new one
    const previousToken = readSessionCookie(req);
    if (previousToken) await closeSession(previousToken);
    const session = await openSession(outcome.userId, outcome.role);
    setSessionCookie(res, session.token, session.expiresAt);

    authLogger.debug('Discord sign-in for', outcome.userId, 'as', outcome.role);
    res.redirect(next);
  } catch (signInError) {
    authLogger.error('Discord sign-in failed:', signInError);
    res.redirect(signInProblemPage('failed', next));
  }
});

// GET /api/auth/session - The account of this browser's session, null when it
// holds none: not signed in is an answer here, not a refusal
router.get('/session', async (req: Request, res: Response) => {
  try {
    const session = await readRequestSession(req, res);
    res.json({ account: session ? await getAccount(session.userId, session.accountType) : null });
  } catch (error) {
    authLogger.error('/session error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// GET /api/auth/me - The account of the session, which must be open
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const account = await getAccount(req.account!.userId, req.account!.accountType);
    if (!account) return res.status(404).json({ errors: [ERROR.userNotFound] });
    res.json({ account });
  } catch (error) {
    authLogger.error('/me error:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/auth/logout - End this browser's session
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  const token = readSessionCookie(req);
  if (token) await closeSession(token);
  clearSessionCookie(res);

  res.json({ message: 'Déconnexion réussie' });
});

// PUT /api/auth/role - Act as another role of the account, in this session only
router.put('/role', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { role } = req.body ?? {};

  try {
    const roles = await heldRoles(req.account!.userId);
    if (!roles) return res.status(404).json({ errors: [ERROR.userNotFound] });
    if (typeof role !== 'string' || !roles.includes(role as AccountType)) {
      return res.status(400).json({ errors: [ERROR.roleNotHeld] });
    }

    const changed = await setSessionRole(readSessionCookie(req)!, ROLE_OF_ACCOUNT_TYPE[role as AccountType]);
    if (!changed) return res.status(401).json({ errors: [ERROR.sessionExpired] });

    authLogger.debug('Role switched to', role, 'for', req.account!.userId);
    res.json({ account: await getAccount(req.account!.userId, role as AccountType) });
  } catch (error) {
    authLogger.error('Role switch error:', error);
    res.status(500).json({ errors: [ERROR.roleSwitchFailed] });
  }
});

// PUT /api/auth/name - Change the name the person shows the others
router.put('/name', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const renamed = await renameAccount(req.account!.userId, req.body?.name);
    if (renamed !== true) return res.status(400).json({ errors: renamed });
    res.json({ account: await getAccount(req.account!.userId, req.account!.accountType) });
  } catch (error) {
    authLogger.error('Rename error:', error);
    res.status(500).json({ errors: [ERROR.nameUpdateFailed] });
  }
});

// GET /api/auth/invitations/:token - An invitation to a role, as its link shows it
router.get('/invitations/:token', async (req: Request, res: Response) => {
  try {
    const invitation = await readInvitation(req.params.token as string);
    if (!invitation) return res.status(404).json({ errors: [ERROR.invitationInvalid] });
    res.json(invitation);
  } catch (error) {
    authLogger.error('Invitation read error:', error);
    res.status(500).json({ errors: [ERROR.invitationFetchFailed] });
  }
});

export default router;
