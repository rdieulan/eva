// Tests for computePlayerInitials - roster-unique badge labels

import { describe, it, expect } from 'vitest';
import { computePlayerInitials } from '@/utils/players';

const P = (id: string, name: string) => ({ playerId: id, playerName: name });

describe('computePlayerInitials', () => {
  it('uses a single letter when first letters do not collide', () => {
    const labels = computePlayerInitials([P('1', 'Alpha'), P('2', 'Bravo')]);
    expect(labels).toEqual({ '1': 'A', '2': 'B' });
  });

  it('extends to 2 letters when first letters collide', () => {
    const labels = computePlayerInitials([P('1', 'Bob'), P('2', 'Bill')]);
    expect(labels).toEqual({ '1': 'BO', '2': 'BI' });
  });

  it('disambiguates three pseudos sharing the same first letter', () => {
    const labels = computePlayerInitials([P('1', 'Alex'), P('2', 'Alice'), P('3', 'Anna')]);
    expect(labels).toEqual({ '1': 'ALE', '2': 'ALI', '3': 'AN' });
    // The whole point: every badge is distinct.
    expect(new Set(Object.values(labels)).size).toBe(3);
  });

  it('keeps word-initials for multi-word names', () => {
    const labels = computePlayerInitials([P('1', 'Jean Dupont'), P('2', 'Marc Petit')]);
    expect(labels).toEqual({ '1': 'JD', '2': 'MP' });
  });

  it('caps at 3 chars and lets identical prefixes share a label (tooltip covers it)', () => {
    const labels = computePlayerInitials([P('1', 'Alexander'), P('2', 'Alexis')]);
    expect(labels['1']).toBe('ALE');
    expect(labels['2']).toBe('ALE');
    expect(labels['1']!.length).toBeLessThanOrEqual(3);
  });

  it('is keyed by playerId, not by name', () => {
    const labels = computePlayerInitials([P('id-a', 'Sam'), P('id-b', 'Sasha')]);
    expect(Object.keys(labels).sort()).toEqual(['id-a', 'id-b']);
    expect(labels['id-a']).not.toBe(labels['id-b']);
  });

  it('falls back to "?" for an empty pseudo', () => {
    const labels = computePlayerInitials([P('1', '')]);
    expect(labels['1']).toBe('?');
  });

  it('produces distinct labels for every distinct pseudo in a realistic roster', () => {
    const roster = [
      P('1', 'Shadow'), P('2', 'Storm'), P('3', 'Spectre'),
      P('4', 'Nova'), P('5', 'Nyx'), P('6', 'Blaze'),
    ];
    const labels = computePlayerInitials(roster);
    expect(new Set(Object.values(labels)).size).toBe(roster.length);
  });
});
