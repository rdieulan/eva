// Integration tests - Database helpers

import { prisma } from '@db/prisma';
import { expect } from 'vitest';

// Re-export prisma for convenience
export { prisma };

// Default template for maps
const DEFAULT_TEMPLATE = {
  assignments: [
    { id: 1, name: "Poste 1", x: 25, y: 25, zone: { x1: 15, y1: 15, x2: 35, y2: 35 } },
    { id: 2, name: "Poste 2", x: 75, y: 25, zone: { x1: 65, y1: 15, x2: 85, y2: 35 } },
    { id: 3, name: "Poste 3", x: 25, y: 75, zone: { x1: 15, y1: 65, x2: 35, y2: 85 } },
    { id: 4, name: "Poste 4", x: 75, y: 75, zone: { x1: 65, y1: 65, x2: 85, y2: 85 } }
  ]
};

// Test maps
const TEST_MAPS = [
  { id: 'test-map-1', name: 'Test Map 1', images: ['/maps/test1.png'] },
  { id: 'test-map-2', name: 'Test Map 2', images: ['/maps/test2.png'] },
];

/**
 * Seed test maps (reference data needed for team creation)
 */
export async function seedTestMaps(): Promise<void> {
  const existingCount = await prisma.map.count();
  if (existingCount > 0) return; // Already seeded

  for (const map of TEST_MAPS) {
    await prisma.map.create({
      data: {
        id: map.id,
        name: map.name,
        images: map.images,
        template: DEFAULT_TEMPLATE,
      },
    });
  }
}

/**
 * Execute an action and verify no record was created
 * @param countFn Function that returns current count
 * @param action The action to execute (should be rejected)
 * @returns The result of the action
 */
export async function expectNoRecordCreated<T>(
  countFn: () => Promise<number>,
  action: () => Promise<T>
): Promise<T> {
  const countBefore = await countFn();
  const result = await action();
  const countAfter = await countFn();
  expect(countAfter).toBe(countBefore);
  return result;
}

/**
 * Clean all test data from the database
 * Order matters due to foreign key constraints
 */
export async function cleanDatabase(): Promise<void> {
  // Delete in order of dependencies (children first)
  await prisma.calendarEvent.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.gamePlanPlayer.deleteMany();
  await prisma.gamePlan.deleteMany();
  await prisma.balanceRule.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.session.deleteMany();
  await prisma.venueManager.deleteMany();
  // Team has FK to Player (leaderId) — must be deleted before Player.
  await prisma.team.deleteMany();
  await prisma.player.deleteMany();
  await prisma.manager.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.user.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.linkedAccountGroup.deleteMany();
}

/**
 * Disconnect Prisma client
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
