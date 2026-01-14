# Project Structure

This document describes the organization of the EVA project.

## Directory Structure

```
/
├── client/                    # Frontend Vue
│   ├── index.html             # Entry HTML
│   ├── vite.config.ts         # Vite configuration
│   ├── tsconfig.json          # TypeScript config for frontend
│   └── src/
│       ├── api/               # API client functions
│       │   ├── auth.api.ts    # Authentication API
│       │   ├── calendar.api.ts # Calendar API (availability, events)
│       │   ├── maps.api.ts    # Maps and game plans API
│       │   └── players.api.ts # Players API
│       ├── components/        # Vue components
│       │   ├── calendar/      # Calendar components
│       │   │   ├── CalendarGrid.vue   # Monthly grid with navigation
│       │   │   ├── DayCell.vue        # Single day cell
│       │   │   └── EventFormModal.vue # Event creation/edit modal
│       │   ├── common/        # Reusable components
│       │   │   └── Modal.vue  # Generic modal component
│       │   ├── layout/        # Layout components (TopBar)
│       │   ├── planner/       # Planner-specific components
│       │   ├── MapList.vue
│       │   ├── MapViewer.vue
│       │   └── RotationCalculator.vue
│       ├── composables/       # Vue composition hooks
│       │   └── useAuth.ts
│       ├── config/            # UI configuration
│       │   └── config.ts      # Main config (re-exports API + services)
│       ├── pages/             # Vue page components
│       │   ├── CalendarPage.vue
│       │   ├── HomePage.vue
│       │   ├── LoginPage.vue
│       │   ├── PlannerPage.vue
│       │   └── ProfilePage.vue
│       ├── router/
│       │   └── index.ts
│       ├── services/          # Business logic
│       │   └── balance.service.ts
│       ├── types/             # Client types (re-exports from shared)
│       │   └── index.ts
│       ├── utils/             # Utility functions
│       │   └── zones.ts
│       ├── App.vue
│       ├── main.ts
│       └── style.css
│
├── server/                    # Backend Express
│   ├── index.ts               # Express entry point
│   ├── tsconfig.json          # TypeScript config for backend
│   └── src/
│       ├── routes/            # API route handlers
│       │   ├── auth.routes.ts
│       │   ├── calendar.routes.ts # Availability & events API
│       │   ├── maps.routes.ts
│       │   ├── plans.routes.ts
│       │   ├── users.routes.ts
│       │   └── index.ts       # Route mounting
│       ├── middleware/        # Express middlewares
│       │   └── auth.middleware.ts
│       ├── services/          # Business logic
│       │   └── auth.service.ts
│       └── db/
│           └── prisma.ts      # Prisma client singleton
│
├── shared/                    # Shared types (frontend + backend)
│   └── types/
│       ├── index.ts           # Barrel export
│       ├── calendar.types.ts  # Availability, CalendarEvent, etc.
│       ├── zone.types.ts      # Zone, Point, etc.
│       ├── player.types.ts    # Player, PlayerAssignment
│       └── map.types.ts       # MapConfig, Assignment, AppState
│
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seeding script
│
├── tests/
│   ├── setup.ts               # Test setup (mocks, etc.)
│   ├── fixtures/              # Test data fixtures
│   ├── client/                # Frontend tests
│   └── server/                # Backend tests
│
├── public/maps/               # Static map images
├── docs/                      # Documentation
│
├── package.json
├── tsconfig.json              # Root TypeScript config
└── vitest.config.mts          # Vitest configuration
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (frontend) |
| `npm run server` | Start Express server (backend) |
| `npm run dev:all` | Start both frontend and backend |
| `npm run build` | Build frontend for production |
| `npm run start` | Start production server |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |

## Module Responsibilities

### shared/types/
Pure TypeScript interfaces and types. No functions, no dependencies.
Used by both frontend and backend.

### client/src/api/
HTTP client functions for API calls:
- `auth.api.ts` - Login, logout, token verification
- `maps.api.ts` - Map CRUD, game plan CRUD
- `players.api.ts` - Player list with caching

### client/src/services/
Business logic that runs on the frontend:
- `balance.service.ts` - Roster validation rules

### client/src/utils/
Pure utility functions:
- `zones.ts` - Zone type guards, polygon conversions

### client/src/config/
UI configuration:
- `config.ts` - Colors, re-exports API + services for convenience

### server/src/routes/
Express route handlers grouped by domain:
- `auth.routes.ts` - /api/auth/*
- `maps.routes.ts` - /api/maps/*
- `plans.routes.ts` - /api/plans/*
- `users.routes.ts` - /api/users/*

### server/src/middleware/
Express middlewares:
- `auth.middleware.ts` - JWT verification, role checking

### server/src/services/
Backend business logic:
- `auth.service.ts` - Password hashing, token generation

### server/src/db/
Database access:
- `prisma.ts` - Prisma client singleton

## Import Conventions

### Client (Vue/Vite)
Uses `@/` and `@shared/` aliases configured in `client/tsconfig.json` and `client/vite.config.ts`:

```typescript
// Types
import type { MapConfig, Player } from '@/types';
import type { Zone } from '@shared/types';

// API calls
import { fetchAllMaps, fetchPlayers } from '@/api';

// Services
import { checkMapBalance } from '@/services';

// Config
import { assignmentColors } from '@/config/config';

// Components
import MapViewer from '@/components/MapViewer.vue';

// Utilities
import { getZonePolygons } from '@/utils/zones';

// Composables
import { useAuth } from '@/composables/useAuth';
```

### Server (Express)
Uses `@db/`, `@middleware/`, `@services/`, `@routes/` aliases configured in `server/tsconfig.json`. At build time, `tsc-alias` transforms aliases to relative paths with `.js` extensions:

```typescript
// Source (TypeScript)
import { prisma } from '@db/prisma';
import { authMiddleware } from '@middleware/auth.middleware';
import { generateToken } from '@services/auth.service';

// Compiled (JavaScript)
import { prisma } from '../db/prisma.js';
```

### Tests
Uses same `@/` and `@shared/` aliases (configured in `vitest.config.mts` and `tests/tsconfig.json`):

```typescript
import type { MapConfig } from '@/types';
import { checkMapBalance } from '@/services';
```
