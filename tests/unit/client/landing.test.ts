// Tests for where an account lands, by the role its session acts as, and for
// the walk-through that comes first for a player
import { describe, it, expect } from 'vitest';
import type { Account } from '@shared/types';
import { landingPathForAccount, needsWalkThrough } from '@/utils/landing';

function account(overrides: Partial<Account>): Account {
  return {
    id: 'user-1', playerId: 'player-1', managerId: null, adminId: null, name: 'Raph',
    accountType: 'player', roles: ['player'], isOnboarded: true, hasEvaAccount: true,
    permissions: {} as Account['permissions'], teamId: null, isLeader: false, managedVenueIds: null, adminPermissions: null,
    ...overrides,
  };
}

describe('landingPathForAccount', () => {
  it('lands each role on its own pages, and nobody on the login', () => {
    expect(landingPathForAccount(account({}))).toBe('/');
    expect(landingPathForAccount(account({ accountType: 'manager', playerId: null, managerId: 'manager-1' }))).toBe('/gestion');
    expect(landingPathForAccount(account({ accountType: 'admin', playerId: null, adminId: 'admin-1' }))).toBe('/admin/venues');
    expect(landingPathForAccount(null)).toBe('/login');
  });
});

describe('needsWalkThrough', () => {
  it('sends a player through the walk-through at their first login, and while they have no eva.gg account', () => {
    expect(needsWalkThrough(account({}))).toBe(false);
    expect(needsWalkThrough(account({ isOnboarded: false }))).toBe(true);
    expect(needsWalkThrough(account({ hasEvaAccount: false }))).toBe(true);
  });

  it('leaves a manager or an admin at work alone, and nobody signed in', () => {
    const noEva = { isOnboarded: false, hasEvaAccount: false };
    expect(needsWalkThrough(account({ ...noEva, accountType: 'manager', playerId: null, managerId: 'manager-1' }))).toBe(false);
    expect(needsWalkThrough(account({ ...noEva, accountType: 'admin', playerId: null, adminId: 'admin-1' }))).toBe(false);
    expect(needsWalkThrough(null)).toBe(false);
  });
});
