// Integration tests - Database helpers

import { prisma } from '@db/prisma';
import { expect } from 'vitest';

// Re-export prisma for convenience
export { prisma };

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
  // Team must be deleted before User because Team.leaderId references User
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Disconnect Prisma client
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
