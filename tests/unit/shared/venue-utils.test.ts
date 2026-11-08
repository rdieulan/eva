// Tests for the venue rules shared by the sync, the server and the admin screens
import { describe, it, expect } from 'vitest';
import { normalizeLinkUrl, isAcceptableLinkInput, slugifyVenueName, freeVenueSlug } from '@shared/utils';

describe('slugifyVenueName', () => {
  it('reads a name as it goes in an address: lowercase, accents dropped, a dash between words', () => {
    expect(slugifyVenueName('Nîmes')).toBe('nimes');
    expect(slugifyVenueName('Toulouse Blagnac')).toBe('toulouse-blagnac');
    expect(slugifyVenueName('Saint-Étienne')).toBe('saint-etienne');
    expect(slugifyVenueName('Béthune / Bruay')).toBe('bethune-bruay');
    expect(slugifyVenueName('  Lançon-Provence  ')).toBe('lancon-provence');
    expect(slugifyVenueName('Cœur de Ville')).toBe('coeur-de-ville');
  });

  it('reads "salle" when nothing of the name is left', () => {
    expect(slugifyVenueName('—')).toBe('salle');
  });
});

describe('freeVenueSlug', () => {
  it('takes the name read for an address, or the first number after it no venue holds yet', () => {
    expect(freeVenueSlug('Nîmes', new Set())).toBe('nimes');
    expect(freeVenueSlug('Nîmes', new Set(['nimes']))).toBe('nimes-2');
    expect(freeVenueSlug('Nîmes', new Set(['nimes', 'nimes-2', 'nimes-3']))).toBe('nimes-4');
  });
});

describe('normalizeLinkUrl', () => {
  it('keeps an absolute http(s) URL, trimmed', () => {
    expect(normalizeLinkUrl(' https://discord.gg/eva ')).toBe('https://discord.gg/eva');
    expect(normalizeLinkUrl('http://example.org')).toBe('http://example.org');
  });

  it('drops anything that is not a web address', () => {
    expect(normalizeLinkUrl('discord.gg/eva')).toBeNull();
    expect(normalizeLinkUrl('@evanimes')).toBeNull();
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkUrl('ftp://files.example.org')).toBeNull();
  });

  it('turns a blank or a non-string into no link', () => {
    expect(normalizeLinkUrl('')).toBeNull();
    expect(normalizeLinkUrl('   ')).toBeNull();
    expect(normalizeLinkUrl(null)).toBeNull();
    expect(normalizeLinkUrl(42)).toBeNull();
  });
});

describe('isAcceptableLinkInput', () => {
  it('accepts a web address, an empty field, or no field at all', () => {
    expect(isAcceptableLinkInput('https://discord.gg/eva')).toBe(true);
    expect(isAcceptableLinkInput('')).toBe(true);
    expect(isAcceptableLinkInput(null)).toBe(true);
    expect(isAcceptableLinkInput(undefined)).toBe(true);
  });

  it('refuses a value that is not a web address', () => {
    expect(isAcceptableLinkInput('discord.gg/eva')).toBe(false);
    expect(isAcceptableLinkInput('javascript:alert(1)')).toBe(false);
    expect(isAcceptableLinkInput(42)).toBe(false);
  });
});
