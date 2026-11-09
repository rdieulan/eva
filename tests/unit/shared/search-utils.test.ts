// Tests for comparing names the way a reader does
import { describe, it, expect } from 'vitest';
import { foldForSearch } from '@shared/utils';

describe('foldForSearch', () => {
  it('reads a name the same whatever its case, accents and punctuation', () => {
    for (const name of ['Nîmes', 'NIMES', 'nimes !', '  Nïmés  ']) {
      expect(foldForSearch(name)).toBe('nimes');
    }
  });

  it('keeps one space between words, whatever separated them', () => {
    expect(foldForSearch('RONIN-Esport')).toBe('ronin esport');
    expect(foldForSearch('Team_Zero.2')).toBe('team zero 2');
  });

  it('makes decorated letters plain', () => {
    expect(foldForSearch('ＲＯＮＩＮ')).toBe('ronin');
    expect(foldForSearch('𝓡𝓸𝓷𝓲𝓷')).toBe('ronin');
    expect(foldForSearch('Œuvre Ærø Straße')).toBe('oeuvre aero strasse');
  });

  it('drops emojis but keeps the letters of every script', () => {
    expect(foldForSearch('🦊 Fox 🦊')).toBe('fox');
    expect(foldForSearch('Ωmega 火')).toBe('ωmega 火');
    expect(foldForSearch('🔥🔥')).toBe('');
  });
});
