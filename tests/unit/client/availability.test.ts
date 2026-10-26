// Tests for the availability display helpers
import { describe, it, expect } from 'vitest';
import type { PlayerAvailability } from '@shared/types';
import {
  getAvailabilityClass,
  getAvailabilityDisplay,
  getNextAvailabilityStatus,
  sortPlayersByAvailability,
} from '@/utils/availability';

describe('getNextAvailabilityStatus', () => {
  it('cycles from not set through every status, voice only between possible and unavailable', () => {
    expect(getNextAvailabilityStatus(null)).toBe('AVAILABLE');
    expect(getNextAvailabilityStatus('AVAILABLE')).toBe('CONDITIONAL');
    expect(getNextAvailabilityStatus('CONDITIONAL')).toBe('VOICE_ONLY');
    expect(getNextAvailabilityStatus('VOICE_ONLY')).toBe('UNAVAILABLE');
    expect(getNextAvailabilityStatus('UNAVAILABLE')).toBeNull();
  });
});

describe('getAvailabilityClass', () => {
  it('gives each status a CSS modifier matching $availability-styles', () => {
    expect(getAvailabilityClass('AVAILABLE')).toBe('availability--available');
    expect(getAvailabilityClass('VOICE_ONLY')).toBe('availability--voice-only');
    expect(getAvailabilityClass(null)).toBe('availability--unset');
  });
});

describe('getAvailabilityDisplay', () => {
  it('shows a microphone for voice only', () => {
    expect(getAvailabilityDisplay('VOICE_ONLY')).toEqual({
      label: 'Vocal',
      title: 'Dispo pour le vocal uniquement',
      symbol: { icon: 'mic' },
    });
  });

  it('keeps text glyphs for the other statuses', () => {
    expect(getAvailabilityDisplay('AVAILABLE').symbol).toEqual({ text: '✓' });
    expect(getAvailabilityDisplay(null).symbol).toEqual({ text: '?' });
  });
});

describe('sortPlayersByAvailability', () => {
  it('sorts from most to least available, not set last, then by name', () => {
    const players: PlayerAvailability[] = [
      { playerId: '1', playerName: 'Zed', status: null },
      { playerId: '2', playerName: 'Yan', status: 'UNAVAILABLE' },
      { playerId: '3', playerName: 'Xia', status: 'VOICE_ONLY' },
      { playerId: '4', playerName: 'Wes', status: 'CONDITIONAL' },
      { playerId: '5', playerName: 'Vic', status: 'AVAILABLE' },
      { playerId: '6', playerName: 'Uma', status: 'VOICE_ONLY' },
    ];

    expect(sortPlayersByAvailability(players).map(p => p.playerName))
      .toEqual(['Vic', 'Wes', 'Uma', 'Xia', 'Yan', 'Zed']);
  });
});
