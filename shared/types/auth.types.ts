// Authentication types

import type { User } from './user.types';

/**
 * Login response from the API
 */
export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}
