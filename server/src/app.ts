// Express app configuration (exported for testing with Supertest)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from "@routes/index";
import { logger } from '@utils/logger';
import { venueBoardPage } from '@services/venue-board-page.service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust the first proxy in front of us (Railway, etc.) so that
// req.protocol / req.get('host') reflect the public origin.
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());

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
