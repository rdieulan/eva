// Validation utilities - Single source of truth for all validation rules
// Used by both server and client

import { ERROR } from '@shared/constants';
import {
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  TEAM_NAME_MIN_LENGTH,
} from '@shared/constants/validation.constants';


/**
 * Validation result type
 * - true if valid
 * - string[] with error messages if invalid
 */
export type ValidationResult = true | string[];

// Control characters (line breaks, tabs) and the marks that turn the direction
// of the text around: a name is one line, read the way it is written
const NAME_FORBIDDEN = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/u;
// Something to see: a letter, a digit, a symbol (emojis) or a punctuation mark,
// not only zero-width marks. Those stay allowed around them: emojis are joined by one.
const NAME_VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/** A name as it is kept: no space at either end, and one space between words */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

const NAME_FORBIDDEN_EVERYWHERE = new RegExp(NAME_FORBIDDEN.source, 'gu');

/**
 * A name given on another site, made fit to show here: what a name of ours may
 * not hold (line breaks, direction marks) is dropped rather than refused, then
 * the name is normalized. Empty when nothing visible is left.
 */
export function cleanForeignName(name: string): string {
  const cleaned = normalizeName(name.replace(NAME_FORBIDDEN_EVERYWHERE, ' '));
  return NAME_VISIBLE.test(cleaned) ? cleaned : '';
}

/**
 * Validate a person's name, once normalized: 2 to 32 characters, as Discord
 * allows its own (accents, spaces and emojis are fine)
 */
export function validateName(name: string): ValidationResult {
  const errors: string[] = [];
  const normalized = normalizeName(name);
  const length = [...normalized].length;

  if (length < NAME_MIN_LENGTH) {
    errors.push(ERROR.nameTooShort);
  }

  if (length > NAME_MAX_LENGTH) {
    errors.push(ERROR.nameTooLong);
  }

  if (NAME_FORBIDDEN.test(name)) {
    errors.push(ERROR.nameInvalidChars);
  }

  if (!NAME_VISIBLE.test(normalized)) {
    errors.push(ERROR.nameNotVisible);
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
    errors.push(ERROR.teamNameTooShort);
  }

  return errors.length ? errors : true;
}

// ============================================
// Helper for quick boolean checks (client-side)
// ============================================

export const isValidName = (name: string): boolean => validateName(name) === true;
