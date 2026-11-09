// Changes come from the app's own pages only. A browser sends the session
// cookie with any request to us; SameSite keeps it off the changes another site
// would send, and this check stands behind it: a browser always says which site
// sends a change (Origin), and a page cannot lie about it.

import type { NextFunction, Request, Response } from 'express';
import { ERROR } from '@shared/constants';
import { appOrigin } from '@utils/app-url';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOriginChanges(req: Request, res: Response, next: NextFunction) {
  if (READS.has(req.method)) return next();

  const origin = req.get('origin');
  // Not sent from a page (a script, a test): no visitor's cookie rides along
  if (origin === undefined) return next();

  // Without the app's address (APP_URL), no page is known as ours: refused
  if (origin === appOrigin()) return next();

  return res.status(403).json({ errors: [ERROR.foreignOrigin] });
}
