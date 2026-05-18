// Tests for calendar helper functions

import { describe, it, expect } from 'vitest';
import { formatEventForFrontend } from '@services/helpers/calendar.helper';

describe('formatEventForFrontend', () => {
  it('should format event with all fields', () => {
    const event = {
      id: 'event-1',
      date: new Date(2026, 0, 15),
      startTime: '19:00',
      endTime: '21:00',
      type: 'MATCH' as const,
      title: 'Match de championnat',
      description: 'Match important',
      gamePlan: { absentPlayerId: 'p1', absentPlayerName: 'Player1', maps: [] },
      createdById: 'user-1',
      createdAt: new Date('2026-01-10T10:00:00Z'),
    };

    const result = formatEventForFrontend(event);

    expect(result.id).toBe('event-1');
    expect(result.date).toBe('2026-01-15');
    expect(result.startTime).toBe('19:00');
    expect(result.endTime).toBe('21:00');
    expect(result.type).toBe('MATCH');
    expect(result.title).toBe('Match de championnat');
    expect(result.description).toBe('Match important');
    expect(result.gamePlan).toEqual({ absentPlayerId: 'p1', absentPlayerName: 'Player1', maps: [] });
    expect(result.createdById).toBe('user-1');
    expect(result.createdAt).toBe('2026-01-10T10:00:00.000Z');
  });

  it('should handle null description and gamePlan', () => {
    const event = {
      id: 'event-2',
      date: new Date(2026, 0, 15),
      startTime: '19:00',
      endTime: '21:00',
      type: 'EVENT' as const,
      title: 'Entrainement',
      description: null,
      gamePlan: null,
      createdById: 'user-1',
      createdAt: new Date('2026-01-10T10:00:00Z'),
    };

    const result = formatEventForFrontend(event);

    expect(result.description).toBeUndefined();
    expect(result.gamePlan).toBeUndefined();
  });
});
