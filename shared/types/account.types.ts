// Account types

import type { AccountPermissions } from './permissions.types';

/**
 * Account type (Player, Manager, or Admin)
 */
export type AccountType = 'player' | 'manager' | 'admin';

/**
 * Account data returned from auth endpoints
 */
export interface Account {
  id: string;           // User ID
  playerId: string | null;  // Player ID (null if not a player)
  managerId: string | null; // Manager ID (null if not a manager)
  adminId: string | null;   // Admin ID (null if not an admin)
  email: string;
  name: string;
  accountType: AccountType;
  permissions: AccountPermissions;
  // Player-specific data (null if not a player)
  teamId: string | null;
  isLeader: boolean;
  // Manager-specific data (null if not a manager)
  managedVenueIds: string[] | null;
}
