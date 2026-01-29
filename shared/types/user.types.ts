// User types

import type { UserPermissions } from './permissions.types';

/**
 * User data
 */
export interface User {
  id: string;
  email: string;
  name: string;
  permissions: UserPermissions;
  teamId: string | null;
  isLeader: boolean;
}
