// Authentication types

import type { Account } from './account.types';

/**
 * The answer of a request that opens or changes a session (development login,
 * role switch): the session itself comes as a cookie
 */
export interface LoginResponse {
  account: Account;
}
