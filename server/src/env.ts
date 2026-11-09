// Environment variables, loaded before any module reads them (imported first
// by app.ts). The local secrets first, from .env.local, never committed (the
// Discord application's secret); then the shared development settings, from
// .env. A variable already set (production, tests) wins over both.

import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });
