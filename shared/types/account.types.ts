// Account types

import type { AccountPermissions, AdminPermissions } from './permissions.types';

/**
 * Account type (Player, Manager, or Admin)
 */
export type AccountType = 'player' | 'manager' | 'admin';

/**
 * Account data returned from auth endpoints: one person, acting as one of
 * their roles. The ids are those of the role acted as, null for the others.
 */
export interface Account {
  id: string;           // User ID
  playerId: string | null;  // Player ID (null when not acting as a player)
  managerId: string | null; // Manager ID (null when not acting as a manager)
  adminId: string | null;   // Admin ID (null when not acting as an admin)
  name: string;
  accountType: AccountType; // The role the session acts as
  roles: AccountType[];     // Every role of the account, to switch between
  isOnboarded: boolean;     // The first-login walk-through was done or skipped
  permissions: AccountPermissions;
  // Player-specific data (null if not a player)
  teamId: string | null;
  isLeader: boolean;
  // Manager-specific data (null if not a manager)
  managedVenueIds: string[] | null;
  // Admin-specific permissions (null if not an admin)
  adminPermissions: AdminPermissions | null;
}

/**
 * An invitation to a role, as its link shows it before anyone accepts it
 */
export interface InvitationSummary {
  role: 'manager' | 'admin';
  invitedName: string | null;
  venueNames: string[]; // The venues a manager will manage; none for an admin
  isExpired: boolean;
}

/**
 * An account the development login offers (never in production)
 */
export interface DevLoginAccount {
  id: string;
  name: string;
  teamName: string | null;
  roles: AccountType[];
}
