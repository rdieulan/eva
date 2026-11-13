// Express app configuration (exported for testing with Supertest)

import './env';
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from "@routes/index";
import { logger } from '@utils/logger';
import { venueBoardPage } from '@services/venue-board-page.service';
import { sameOriginChanges } from '@middleware/same-origin.middleware';
import { securityHeaders } from '@middleware/security-headers.middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust the one proxy in front of us, Railway's, and no other: what it
// forwards is the client's; a forwarded header from further away could be made
// up, and would fool any limit by address.
app.set('trust proxy', 1);

// Middleware. No CORS: the pages and the API share one address, and no other
// site is to call the API from a browser. The security headers come first, so
// every answer carries them, the pages, their files and the API alike.
app.use(securityHeaders);
app.use(express.json());
app.use(cookieParser());
app.use('/api', sameOriginChanges);

// Request logger (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });
}

// API routes
app.use('/api', routes);

// Serve frontend in production. Resolve from CWD (Docker WORKDIR /app) which is
// independent of where the compiled JS ends up under dist-server/.
if (isProduction) {
  const distPath = path.join(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');
  app.use(express.static(distPath));
  // A venue's public board, shared on Discord and the like: its link shows the venue
  app.get('/salles/:slug', venueBoardPage(fs.readFileSync(indexPath, 'utf8')));
  app.use((_req, res) => {
    res.sendFile(indexPath);
  });
}
