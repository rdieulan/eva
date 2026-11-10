// Where an account lands, by the role its session acts as: kept apart from the
// router so a component can tell it without loading the router itself

import type { Account } from '@shared/types';

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
