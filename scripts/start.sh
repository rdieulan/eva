#!/bin/sh
# Startup script for production
# Handles baseline migration for existing databases

echo "[STARTUP] Running database migrations..."

# Try to resolve init migration as applied (will fail silently if already done)
# This handles existing databases that don't have migration history yet
npx prisma migrate resolve --applied 0001_init 2>/dev/null || true

# Apply any pending migrations
echo "[STARTUP] Applying pending migrations..."
npx prisma migrate deploy

echo "[STARTUP] Starting server..."
exec node dist-server/server/index.js
