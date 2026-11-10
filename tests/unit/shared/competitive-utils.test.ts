// Tests for the links into competitive.eva.gg, and the end of a registration as
// a player reads it, in Paris time whatever the season
import { describe, it, expect } from 'vitest';
import { competitiveRegistrationUrl, formatRegistrationDeadline } from '@shared/utils';

describe('competitiveRegistrationUrl', () => {
  it('leads to the registration page of a tournament', () => {
    expect(competitiveRegistrationUrl('2570489683180220415'))
      .toBe('https://competitive.eva.gg/fr/tournaments/2570489683180220415/registration');
  });
});

describe('formatRegistrationDeadline', () => {
  it('reads a closing at midnight in Paris as the end of the day before, winter and summer', () => {
    expect(formatRegistrationDeadline('2026-11-29T23:00:00+00:00')).toBe('jusqu\'au dim. 29/11');
    expect(formatRegistrationDeadline('2026-06-02T22:00:00+00:00')).toBe('jusqu\'au mar. 02/06');
    // The night the clocks go back: midnight is still 23:00 the day before in UTC
    expect(formatRegistrationDeadline('2026-10-25T23:00:00+00:00')).toBe('jusqu\'au dim. 25/10');
  });

  it('says the hour of a closing at another time', () => {
    expect(formatRegistrationDeadline('2026-11-30T17:00:00+00:00')).toBe('jusqu\'au lun. 30/11 à 18:00');
  });

  it('goes back across a month and a year', () => {
    expect(formatRegistrationDeadline('2026-11-30T23:00:00Z')).toBe('jusqu\'au lun. 30/11');
    expect(formatRegistrationDeadline('2026-12-31T23:00:00Z')).toBe('jusqu\'au jeu. 31/12');
  });
});
