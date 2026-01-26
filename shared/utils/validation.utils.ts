// Validation utilities - Single source of truth for all validation rules
// Used by both server and client

// ============================================
// Validation Rules
// ============================================

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MIN_LENGTH = 3;
export const NAME_REGEX = /^[a-zA-Z0-9]+$/;
export const TEAM_NAME_MIN_LENGTH = 2;

/**
 * Validation result type
 * - true if valid
 * - string[] with error messages if invalid
 */
export type ValidationResult = true | string[];

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!EMAIL_REGEX.test(email)) {
    errors.push('Format d\'email invalide');
  }

  return errors.length ? errors : true;
}

/**
 * Validate password rules:
 * - Min 8 characters
 * - At least one digit
 * - At least one uppercase letter
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`);
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }

  return errors.length ? errors : true;
}

/**
 * Validate name rules:
 * - Min 3 characters
 * - Only alphanumeric characters (letters and digits)
 */
export function validateName(name: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = name.trim();

  if (trimmed.length < NAME_MIN_LENGTH) {
    errors.push(`Le pseudo doit contenir au moins ${NAME_MIN_LENGTH} caractères`);
  }

  if (!NAME_REGEX.test(trimmed)) {
    errors.push('Le pseudo ne doit contenir que des lettres et des chiffres');
  }

  return errors.length ? errors : true;
}

/**
 * Validate team name rules:
 * - Min 2 characters
 */
export function validateTeamName(name: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = name?.trim() || '';

  if (trimmed.length < TEAM_NAME_MIN_LENGTH) {
    errors.push(`Le nom de l'équipe doit contenir au moins ${TEAM_NAME_MIN_LENGTH} caractères`);
  }

  return errors.length ? errors : true;
}

/**
 * Check if passwords match
 */
export function validatePasswordsMatch(password: string, confirmPassword: string): ValidationResult {
  if (password !== confirmPassword) {
    return ['Les mots de passe ne correspondent pas'];
  }
  return true;
}

/**
 * Validate all registration fields at once
 */
export function validateRegistration(data: {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}): ValidationResult {
  const errors: string[] = [];

  const emailResult = validateEmail(data.email);
  if (emailResult !== true) errors.push(...emailResult);

  const passwordResult = validatePassword(data.password);
  if (passwordResult !== true) errors.push(...passwordResult);

  const matchResult = validatePasswordsMatch(data.password, data.confirmPassword);
  if (matchResult !== true) errors.push(...matchResult);

  const nameResult = validateName(data.name);
  if (nameResult !== true) errors.push(...nameResult);

  return errors.length ? errors : true;
}

// ============================================
// Helper for quick boolean checks (client-side)
// ============================================

export const isValidEmail = (email: string): boolean => validateEmail(email) === true;
export const isValidPassword = (password: string): boolean => validatePassword(password) === true;
export const isValidName = (name: string): boolean => validateName(name) === true;
