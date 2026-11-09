// The development login: act as any account of the local database, without
// Discord. Mounted only where dev-login.service allows it, never in production.

import { Router } from 'express';
import type { Request, Response } from 'express';
import { ERROR } from '@shared/constants';
import { authLogger } from '@utils/logger';
import { getAccount } from '@services/auth.service';
import { closeSession, openSession } from '@services/session.service';
import { devLoginAccountExists, isLocalRequest, listDevLoginAccounts } from '@services/dev-login.service';
import { readSessionCookie, setSessionCookie } from '@utils/auth-cookies';

const router = Router();

// The local machine only
router.use((req: Request, res: Response, next) => {
  if (isLocalRequest(req.socket.remoteAddress)) return next();
  authLogger.warn('Dev login refused to a remote address:', req.socket.remoteAddress);
  res.status(403).json({ errors: [ERROR.forbidden] });
});

// GET /api/auth/dev/accounts - The accounts to act as
router.get('/accounts', async (_req: Request, res: Response) => {
  try {
    res.json(await listDevLoginAccounts());
  } catch (error) {
    authLogger.error('Dev login: listing failed:', error);
    res.status(500).json({ errors: [ERROR.devLoginFailed] });
  }
});

// POST /api/auth/dev/login - Open a session for an account, as a player
router.post('/login', async (req: Request, res: Response) => {
  const { userId } = req.body ?? {};

  try {
    if (typeof userId !== 'string' || !(await devLoginAccountExists(userId))) {
      return res.status(404).json({ errors: [ERROR.userNotFound] });
    }

    const previousToken = readSessionCookie(req);
    if (previousToken) await closeSession(previousToken);
    const session = await openSession(userId);
    setSessionCookie(res, session.token, session.expiresAt);

    authLogger.debug('Dev login as', userId);
    res.json({ account: await getAccount(userId, 'player') });
  } catch (error) {
    authLogger.error('Dev login failed:', error);
    res.status(500).json({ errors: [ERROR.devLoginFailed] });
  }
});

export default router;
