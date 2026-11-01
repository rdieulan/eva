// Tests for the venue link rules shared by the sync and the admin screens
import { describe, it, expect } from 'vitest';
import { normalizeLinkUrl, isAcceptableLinkInput } from '@shared/utils';

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
