// One address for the app. In production, a request on any other address the
// server answers on, eva-calendar.com, a www, Railway's own, is sent to the
// app's address (APP_URL), its path and query kept: the app is served on that
// address only, where its links, its session and the Discord sign-in live
// (see "L'adresse du site" in docs/PRODUIT.md). Railway's health check, which
// comes on an address of its own, is answered where it is.

import type { NextFunction, Request, Response } from 'express';
import { appOrigin } from '@utils/app-url';

const HEALTH_PATH = '/api/health';

// A read moves for good; any other request keeps its method and body
const READS = new Set(['GET', 'HEAD']);

export function canonicalHost(req: Request, res: Response, next: NextFunction) {
  const origin = appOrigin();
  // Without the app's address, no other is known to send to
  if (!origin || req.path === HEALTH_PATH) return next();
  if (req.hostname?.toLowerCase() === new URL(origin).hostname) return next();

  res.redirect(READS.has(req.method) ? 301 : 308, `${origin}${req.originalUrl}`);
}
