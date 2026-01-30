import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validatePasswordsMatch,
  validateName,
  validateTeamName,
  validateRegistration,
  PASSWORD_MIN_LENGTH,
  NAME_MIN_LENGTH,
  TEAM_NAME_MIN_LENGTH,
} from '@shared/utils';

// ============================================
// UNIT TESTS: Shared Validation Utils
// These functions are used by both client and server
// ============================================

describe('Validation Utils', () => {
  // ----------------------------------------
  // Email Validation
  // ----------------------------------------
  describe('validateEmail', () => {
    it('should accept valid email formats', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@domain.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('notanemail')).not.toBe(true);
      expect(validateEmail('@nodomain.com')).not.toBe(true);
    });
  });

  // ----------------------------------------
  // Name Validation
  // ----------------------------------------
  describe('validateName', () => {
    it('should accept alphanumeric names at NAME_MIN_LENGTH', () => {
      const validName = 'A1x'.slice(0, NAME_MIN_LENGTH).padEnd(NAME_MIN_LENGTH, '0');
      expect(validateName(validName)).toBe(true);
    });

    it('should reject names shorter than NAME_MIN_LENGTH', () => {
      expect(validateName('A1'.slice(0, NAME_MIN_LENGTH - 1))).not.toBe(true);
    });

    it('should reject names with spaces or special characters', () => {
      expect(validateName('John Doe')).not.toBe(true);
      expect(validateName('test_name')).not.toBe(true);
    });
  });

  // ----------------------------------------
  // Team Name Validation
  // ----------------------------------------
  describe('validateTeamName', () => {
    it('should accept team names at TEAM_NAME_MIN_LENGTH', () => {
      const validName = 'AB'.slice(0, TEAM_NAME_MIN_LENGTH);
      expect(validateTeamName(validName)).toBe(true);
    });

    it('should reject team names shorter than TEAM_NAME_MIN_LENGTH', () => {
      const tooShort = 'A'.slice(0, TEAM_NAME_MIN_LENGTH - 1);
      expect(validateTeamName(tooShort)).not.toBe(true);
    });

    it('should handle null/undefined gracefully', () => {
      expect(validateTeamName(null as unknown as string)).not.toBe(true);
      expect(validateTeamName(undefined as unknown as string)).not.toBe(true);
    });
  });

  // ----------------------------------------
  // Password Validation
  // ----------------------------------------
  describe('validatePassword', () => {
    it('should accept passwords meeting all criteria', () => {
      expect(validatePassword('Password1')).toBe(true);
    });

    it('should reject passwords shorter than PASSWORD_MIN_LENGTH', () => {
      const tooShort = 'Aa1xxxx'.slice(0, PASSWORD_MIN_LENGTH - 1);
      expect(validatePassword(tooShort)).not.toBe(true);
    });

    it('should reject passwords without digits', () => {
      expect(validatePassword('A'.repeat(PASSWORD_MIN_LENGTH))).not.toBe(true);
    });

    it('should reject passwords without uppercase', () => {
      expect(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH - 1) + '1')).not.toBe(true);
    });

    it('should return errors array when validation fails', () => {
      const result = validatePassword('x');
      expect(result).not.toBe(true);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ----------------------------------------
  // Password Confirmation
  // ----------------------------------------
  describe('validatePasswordsMatch', () => {
    it('should accept matching passwords', () => {
      expect(validatePasswordsMatch('Password1', 'Password1')).toBe(true);
    });

    it('should reject non-matching passwords', () => {
      expect(validatePasswordsMatch('Password1', 'Different1')).not.toBe(true);
    });
  });

  // ----------------------------------------
  // Full Registration Validation
  // ----------------------------------------
  describe('validateRegistration', () => {
    it('should accept valid registration data', () => {
      expect(validateRegistration({
        email: 'user@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        name: 'Player123',
      })).toBe(true);
    });

    it('should return errors array when data is invalid', () => {
      const result = validateRegistration({
        email: 'invalid',
        password: 'x',
        confirmPassword: 'y',
        name: '',
      });
      expect(result).not.toBe(true);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
