# Tests Documentation

## Overview

This project uses **Vitest** as the testing framework, integrated with Vue Test Utils for component testing.

## Running Tests

```bash
# Run tests once
npm run test:run

# Run tests in watch mode (interactive)
npm run test

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── setup.ts                    # Global test setup (mocks, etc.)
├── client/                     # Client-side tests
│   ├── types.test.ts           # Zone type guards and conversions
│   ├── config.test.ts          # Configuration helpers
│   ├── balance.test.ts         # Team balance validation rules
│   ├── rotation-calculator.test.ts  # Rotation calculator algorithm
│   ├── map-viewer.test.ts      # MapViewer component logic
│   ├── vue-components.test.ts  # Vue component patterns
│   ├── calendar-api.test.ts    # Calendar API calls
│   ├── calendar-grid.test.ts   # Calendar grid component
│   ├── calendar-integration.test.ts # Calendar integration tests
│   ├── event-form-modal.test.ts # Event form modal component
│   └── game-plan-table.test.ts # Game plan table component
└── server/                     # Server-side tests
    ├── auth.test.ts            # Authentication flow
    ├── api.test.ts             # API endpoints (mocked)
    ├── calendar-routes.test.ts # Calendar routes API
    └── server-logic.test.ts    # Server-side logic
```

## Test Categories

### Unit Tests

#### Types (`types.test.ts`)
- Zone type guards (`isZonePolygon`, `isZoneMulti`)
- Zone conversions (`rectToPolygon`, `getZonePolygons`)
- **14 tests**

#### Configuration (`config.test.ts`)
- Assignment colors validation
- Player assignments helpers
- **10 tests**

#### Balance Validation (`balance.test.ts`)
- Assignment coverage rules
- Player assignment constraints
- Duplicate pair detection
- Rotation validity checks
- **9 tests**

#### Rotation Calculator (`rotation-calculator.test.ts`)
- Valid configuration finding
- Error detection
- Configuration counting
- **8 tests**

#### Authentication (`auth.test.ts`)
- JWT token handling
- Permission computation
- Login/logout flows
- Password change
- **13 tests**

#### API (`api.test.ts`)
- Maps CRUD operations
- Players API
- Game Plans API
- **11 tests**

#### Map Viewer (`map-viewer.test.ts`)
- Coordinate conversion
- SVG path generation
- Polygon edge calculation
- Assignment visibility
- Player assignment toggle
- **16 tests**

#### Vue Components (`vue-components.test.ts`)
- Reactive props
- Event emission
- Conditional rendering
- Form handling
- Mouse/keyboard events
- **14 tests**

#### Server Logic (`server-logic.test.ts`)
- Password hashing
- JWT generation
- Role-based access control
- Game plan validation
- Session management
- **20 tests**


## Mocking

### localStorage
Mocked in `setup.ts` with full API:
- `getItem`, `setItem`, `removeItem`, `clear`

### fetch API
Mocked globally, reset before each test:
```typescript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(data),
});
```

## Best Practices

1. **Isolate tests**: Each test should be independent
2. **Use fixtures**: Import from `fixtures/` for consistent data
3. **Mock external calls**: Never make real API calls in tests
4. **Test edge cases**: Empty arrays, null values, boundary conditions
5. **Descriptive names**: Test names should describe the expected behavior

## Adding New Tests

1. Create a new file in `tests/unit/` with `.test.ts` extension
2. Import Vitest utilities:
   ```typescript
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   ```
3. Group related tests with `describe` blocks
4. Use `beforeEach` for setup that applies to all tests in a block
5. Run tests to verify they pass

## Coverage

Run `npm run test:coverage` to generate a coverage report. The report will be available in the `coverage/` directory.

Target coverage thresholds:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

