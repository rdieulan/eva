import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  validateName,
  validateTeamName,
} from '@shared/utils';
import {
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  TEAM_NAME_MIN_LENGTH,
} from '@shared/constants/validation.constants';
import { ERROR } from '@shared/constants';

// ============================================
// UNIT TESTS: Shared Validation Utils
// These functions are used by both client and server
// ============================================

describe('Validation Utils', () => {
  // ----------------------------------------
  // Name Validation: a person's name follows Discord's own bounds
  // ----------------------------------------
  describe('validateName', () => {
    it('accepts the names Discord allows: accents, spaces, emojis, 2 to 32 characters', () => {
      for (const name of ['Raphaël', 'Sib 🎮', 'raph_42', 'x'.repeat(NAME_MIN_LENGTH), 'x'.repeat(NAME_MAX_LENGTH)]) {
        expect(validateName(name)).toBe(true);
      }
    });

    it('counts an emoji as one character', () => {
      expect(validateName('🎮🎮')).toBe(true);
      expect(validateName('🎮'.repeat(NAME_MAX_LENGTH + 1))).toEqual([ERROR.nameTooLong]);
    });

    it('rejects a name too short or too long once normalized', () => {
      expect(validateName('  a  ')).toEqual([ERROR.nameTooShort]);
      expect(validateName('x'.repeat(NAME_MAX_LENGTH + 1))).toEqual([ERROR.nameTooLong]);
    });

    it('wants something to see, and keeps the marks that join an emoji', () => {
      for (const invisible of ['\u200B\u200B', '\u00AD\u00AD\u00AD', '\u2060\u2060', '\u200F\u200F']) {
        expect(validateName(invisible)).toContain(ERROR.nameNotVisible);
      }
      expect(validateName('👨‍👩‍👧 Nova')).toBe(true);
    });

    it('rejects line breaks and the marks that turn the text around', () => {
      expect(validateName('two\nlines')).toEqual([ERROR.nameInvalidChars]);
      expect(validateName('tab\tbed')).toEqual([ERROR.nameInvalidChars]);
      expect(validateName('abc‮def')).toEqual([ERROR.nameInvalidChars]);
    });
  });

  describe('normalizeName', () => {
    it('trims the ends and keeps one space between words', () => {
      expect(normalizeName('  Raphaël   le  Grand ')).toBe('Raphaël le Grand');
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
});
