// Authentication types

import type { Account } from './account.types';

/**
 * Login response from the API
 */
export interface LoginResponse {
  token: string;
  account: Account;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}
