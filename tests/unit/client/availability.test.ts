// Tests for the availability display helpers
import { describe, it, expect } from 'vitest';
import type { PlayerAvailability } from '@shared/types';
import { TEAM_PLAYER_COUNT } from '@shared/constants';
import { assessTeamAvailability } from '@shared/utils';
import {
  describeAvailability,
  describeTeamAvailability,
  getAvailabilityClass,
  getAvailabilityDisplay,
  getHoursMark,
  sortPlayersByAvailability,
} from '@/utils/availability';

describe('getAvailabilityClass', () => {
  it('gives each status a CSS modifier matching $availability-colors', () => {
    expect(getAvailabilityClass('AVAILABLE')).toBe('availability--available');
    expect(getAvailabilityClass('PARTIAL')).toBe('availability--partial');
    expect(getAvailabilityClass('VOICE_ONLY')).toBe('availability--voice-only');
    expect(getAvailabilityClass(null)).toBe('availability--unset');
  });
});

describe('getAvailabilityDisplay', () => {
  it('names each answer as the wheel shows it', () => {
    expect(getAvailabilityDisplay('VOICE_ONLY')).toEqual({ label: 'En ligne', title: 'Dispo en ligne seulement, pas en salle', symbol: { icon: 'mic' } });
    expect(getAvailabilityDisplay('PARTIAL').symbol).toEqual({ icon: 'clock' });
    expect(getAvailabilityDisplay(null)).toEqual({ label: 'Indéfini', title: 'Non renseigné', symbol: { text: '?' } });
  });

  it('keeps text glyphs for the plain answers', () => {
    expect(getAvailabilityDisplay('AVAILABLE').symbol).toEqual({ text: '✓' });
    expect(getAvailabilityDisplay('UNAVAILABLE').symbol).toEqual({ text: '✗' });
  });
});

describe('getHoursMark', () => {
  it('gives a line per bound, the dash on the side the hours run', () => {
    expect(getHoursMark({ startTime: '20:00', endTime: '23:00' })).toEqual(['20h', '–23h']);
    expect(getHoursMark({ startTime: '21:30', endTime: '23:15' })).toEqual(['21h30', '–23h15']);
    expect(getHoursMark({ startTime: '09:00', endTime: null })).toEqual(['9h–']);
    expect(getHoursMark({ startTime: null, endTime: '22:00' })).toEqual(['–22h']);
  });
});

describe('describeAvailability', () => {
  it('says the hours of a partial availability, the meaning of the others', () => {
    expect(describeAvailability('PARTIAL', { startTime: '20:00', endTime: '23:00' })).toBe('Dispo pour jouer de 20:00 à 23:00');
    expect(describeAvailability('PARTIAL', { startTime: null, endTime: '22:00' })).toBe('Dispo pour jouer jusqu\'à 22:00');
    expect(describeAvailability('AVAILABLE', null)).toBe('Dispo pour jouer');
    expect(describeAvailability(null, null)).toBe('Non renseigné');
  });
});

describe('describeTeamAvailability', () => {
  it('says when a lineup on part of the day meets', () => {
    const shaky = assessTeamAvailability([
      ...Array.from({ length: TEAM_PLAYER_COUNT - 1 }, () => ({ status: 'AVAILABLE' as const })),
      { status: 'PARTIAL' as const, hours: { startTime: '21:00', endTime: null } },
    ]);
    expect(describeTeamAvailability(shaky)).toBe(`${TEAM_PLAYER_COUNT} joueurs ensemble à partir de 21:00 seulement`);
    expect(describeTeamAvailability(assessTeamAvailability([]))).toBe(`Moins de ${TEAM_PLAYER_COUNT} joueurs mobilisables`);
  });
});

describe('sortPlayersByAvailability', () => {
  it('sorts from most to least available, not set last, then by name', () => {
    const players: PlayerAvailability[] = [
      { playerId: '1', playerName: 'Zed', status: null, hours: null },
      { playerId: '2', playerName: 'Yan', status: 'UNAVAILABLE', hours: null },
      { playerId: '3', playerName: 'Xia', status: 'VOICE_ONLY', hours: null },
      { playerId: '4', playerName: 'Wes', status: 'PARTIAL', hours: { startTime: '21:00', endTime: null } },
      { playerId: '5', playerName: 'Vic', status: 'AVAILABLE', hours: null },
      { playerId: '6', playerName: 'Uma', status: 'VOICE_ONLY', hours: null },
    ];

    expect(sortPlayersByAvailability(players).map(p => p.playerName))
      .toEqual(['Vic', 'Wes', 'Uma', 'Xia', 'Yan', 'Zed']);
  });
});
