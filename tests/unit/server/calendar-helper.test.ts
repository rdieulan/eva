// Tests for calendar helper functions

import { describe, it, expect } from 'vitest';
import {
  formatEventForFrontend,
  resolveMediumForCreate,
  resolveMediumForUpdate,
} from '@services/helpers/calendar.helper';
import { ERROR } from '@shared/constants';

describe('formatEventForFrontend', () => {
  it('should format event with all fields', () => {
    const event = {
      id: 'event-1',
      date: new Date(Date.UTC(2026, 0, 15)),
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
      date: new Date(Date.UTC(2026, 0, 15)),
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

  it('should pass on the platform a voice meeting is held on', () => {
    const event = {
      id: 'event-3',
      date: new Date(Date.UTC(2026, 0, 15)),
      startTime: '21:00',
      endTime: '22:00',
      type: 'VOICE_MEETING' as const,
      title: 'Strat Polaris',
      description: null,
      gamePlan: null,
      voiceMedium: 'TEAMSPEAK' as const,
      createdById: 'user-1',
      createdAt: new Date('2026-01-10T10:00:00Z'),
    };

    expect(formatEventForFrontend(event).voiceMedium).toBe('TEAMSPEAK');
    expect(formatEventForFrontend({ ...event, voiceMedium: null }).voiceMedium).toBeUndefined();
  });
});

describe('resolveMediumForCreate', () => {
  it('keeps the platform a voice meeting is held on', () => {
    expect(resolveMediumForCreate({ type: 'VOICE_MEETING', voiceMedium: 'MUMBLE' }))
      .toEqual({ voiceMedium: 'MUMBLE' });
  });

  it('demands a platform, since a meeting nobody can join is of no use', () => {
    expect(resolveMediumForCreate({ type: 'VOICE_MEETING' }))
      .toEqual({ error: ERROR.voiceMediumRequired });
    expect(resolveMediumForCreate({ type: 'VOICE_MEETING', voiceMedium: null }))
      .toEqual({ error: ERROR.voiceMediumRequired });
  });

  it('refuses a platform it does not know', () => {
    expect(resolveMediumForCreate({ type: 'VOICE_MEETING', voiceMedium: 'SKYPE' as never }))
      .toEqual({ error: ERROR.voiceMediumInvalid });
  });

  it('stores no platform on the other event types', () => {
    expect(resolveMediumForCreate({ type: 'MATCH' })).toEqual({ voiceMedium: null });
    expect(resolveMediumForCreate({ type: 'EVENT' })).toEqual({ voiceMedium: null });
  });

  it('refuses a platform on an event that is not held on one', () => {
    expect(resolveMediumForCreate({ type: 'MATCH', voiceMedium: 'DISCORD' }))
      .toEqual({ error: ERROR.voiceMeetingOnlyMedium });
  });
});

describe('resolveMediumForUpdate', () => {
  it('moves the meeting to the platform it is given', () => {
    expect(resolveMediumForUpdate({ type: 'VOICE_MEETING', voiceMedium: 'TELEGRAM', currentMedium: 'DISCORD' }))
      .toEqual({ voiceMedium: 'TELEGRAM' });
  });

  it('leaves the current platform alone when the update says nothing about it', () => {
    expect(resolveMediumForUpdate({ type: 'VOICE_MEETING', currentMedium: 'DISCORD' })).toEqual({});
  });

  it('demands a platform from an event turning into a voice meeting', () => {
    expect(resolveMediumForUpdate({ type: 'VOICE_MEETING', currentMedium: null }))
      .toEqual({ error: ERROR.voiceMediumRequired });
  });

  it('refuses to clear the platform of a meeting', () => {
    expect(resolveMediumForUpdate({ type: 'VOICE_MEETING', voiceMedium: null, currentMedium: 'DISCORD' }))
      .toEqual({ error: ERROR.voiceMediumRequired });
  });

  it('drops the platform of a meeting turning into another event type', () => {
    expect(resolveMediumForUpdate({ type: 'MATCH', currentMedium: 'DISCORD' }))
      .toEqual({ voiceMedium: null });
  });
});
