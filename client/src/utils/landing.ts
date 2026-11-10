// Where an account lands, by the role its session acts as, and whether the
// walk-through comes first: kept apart from the router so a component can
// tell it without loading the router itself

import type { Account } from '@shared/types';

/**
 * Whether a player goes through the walk-through before anything else: at
 * their first login, and while they have no eva.gg account linked, every
 * player having one. Not a manager nor an admin at work.
 */
export function needsWalkThrough(account: Account | null): boolean {
  return account?.accountType === 'player' && (!account.isOnboarded || !account.hasEvaAccount);
}

/**
 * Default landing page based on the account's role.
 * - admin → /admin/venues
 * - manager → /gestion, the space of their venue
 * - player → /
 */
export function landingPathForAccount(account: Account | null): string {
  if (!account) return '/login';
  if (account.adminId) return '/admin/venues';
  if (account.managerId) return '/gestion';
  return '/';
}
