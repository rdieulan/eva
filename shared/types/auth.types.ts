// Authentication types

import type { Account } from './account.types';

/**
 * Login response from the API: the session itself comes as a cookie
 */
export interface LoginResponse {
  account: Account;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}
