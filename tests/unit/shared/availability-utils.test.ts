// Tests for the team-level availability read on a day, and the hours of a partial availability
import { describe, it, expect } from 'vitest';
import {
  assessTeamAvailability,
  windowCovers,
  describeAvailabilityHours,
  formatAvailabilityHours,
  isValidAvailabilityHours,
} from '@shared/utils';
import { TEAM_PLAYER_COUNT } from '@shared/constants';
import type { AvailabilityHours, AvailabilityStatus } from '@shared/types';

type Answer = { status: AvailabilityStatus | null; hours?: AvailabilityHours | null };

function answers(...entries: Array<[AvailabilityStatus | null, number]>): Answer[] {
  return entries.flatMap(([status, count]) => Array.from({ length: count }, () => ({ status })));
}

// A player available on part of the day only
function partial(startTime: string | null, endTime: string | null): Answer {
  return { status: 'PARTIAL', hours: { startTime, endTime } };
}

describe('assessTeamAvailability', () => {
  it('is ready with a full lineup of players available the whole day', () => {
    expect(assessTeamAvailability(answers(['AVAILABLE', TEAM_PLAYER_COUNT])))
      .toEqual({ status: 'ready', available: TEAM_PLAYER_COUNT, partial: 0, voice: 0, pending: 0, window: null });
  });

  it('stays ready with more players than needed, whatever the others say', () => {
    const result = assessTeamAvailability([...answers(['AVAILABLE', TEAM_PLAYER_COUNT + 1], ['UNAVAILABLE', 2], [null, 1]), partial('21:00', null)]);
    expect(result.status).toBe('ready');
    expect(result.window).toBeNull();
  });

  it('is shaky when the lineup needs players available at given hours, and says when it meets', () => {
    const result = assessTeamAvailability([
      ...answers(['AVAILABLE', TEAM_PLAYER_COUNT - 2]),
      partial('20:00', '23:00'),
      partial('21:00', null),
    ]);
    expect(result).toEqual({
      status: 'shaky', available: TEAM_PLAYER_COUNT - 2, partial: 2, voice: 0, pending: 0,
      window: { startTime: '21:00', endTime: '23:00' },
    });
  });

  it('leaves a bound of the day open when the lineup meets from its start or until its end', () => {
    expect(assessTeamAvailability([...answers(['AVAILABLE', TEAM_PLAYER_COUNT - 1]), partial(null, '22:00')]).window)
      .toEqual({ startTime: null, endTime: '22:00' });
    expect(assessTeamAvailability([...answers(['AVAILABLE', TEAM_PLAYER_COUNT - 1]), partial('21:30', null)]).window)
      .toEqual({ startTime: '21:30', endTime: null });
  });

  it('keeps the longest stretch the lineup meets, the earliest of equals', () => {
    const base = answers(['AVAILABLE', TEAM_PLAYER_COUNT - 1]);
    expect(assessTeamAvailability([...base, partial('18:00', '19:00'), partial('20:00', '22:00')]).window)
      .toEqual({ startTime: '20:00', endTime: '22:00' });
    expect(assessTeamAvailability([...base, partial('18:00', '19:00'), partial('20:00', '21:00')]).window)
      .toEqual({ startTime: '18:00', endTime: '19:00' });
  });

  it('needs a stretch long enough for the shortest match: a lineup that only meets for half an hour plays nothing', () => {
    const result = assessTeamAvailability([...answers(['AVAILABLE', TEAM_PLAYER_COUNT - 1], ['VOICE_ONLY', 1]), partial('22:30', '23:00')]);
    expect(result.status).toBe('voice');
    expect(result.window).toBeNull();
    expect(assessTeamAvailability([...answers(['AVAILABLE', TEAM_PLAYER_COUNT - 1]), partial('22:20', '23:00')]).status).toBe('shaky');
  });

  it('is shaky with a lineup made only of players available at given hours, as long as they meet', () => {
    const together = Array.from({ length: TEAM_PLAYER_COUNT }, () => partial('20:00', '22:00'));
    expect(assessTeamAvailability(together).status).toBe('shaky');
    // Hours that never meet make no lineup
    const apart = [partial('14:00', '15:00'), partial('16:00', '17:00'), partial('18:00', '19:00'), partial('20:00', '21:00')];
    expect(assessTeamAvailability(apart).status).toBe('voice');
  });

  it('is voice when the arena is out of reach but a table can meet on voice chat', () => {
    expect(assessTeamAvailability(answers(['VOICE_ONLY', TEAM_PLAYER_COUNT], ['UNAVAILABLE', 1])))
      .toEqual({ status: 'voice', available: 0, partial: 0, voice: TEAM_PLAYER_COUNT, pending: 0, window: null });
    // Players bound for the arena sit at the voice table too, whatever their hours
    expect(assessTeamAvailability([...answers(['AVAILABLE', 1], ['VOICE_ONLY', TEAM_PLAYER_COUNT - 2], ['UNAVAILABLE', 2]), partial('21:00', null)]).status)
      .toBe('voice');
  });

  it('is short once everyone has answered and the players do not add up', () => {
    expect(assessTeamAvailability([...answers(['AVAILABLE', TEAM_PLAYER_COUNT - 2], ['UNAVAILABLE', 2]), partial('21:00', null)]).status)
      .toBe('short');
  });

  it('does not count unavailable players', () => {
    expect(assessTeamAvailability(answers(['AVAILABLE', TEAM_PLAYER_COUNT - 1], ['UNAVAILABLE', 3])))
      .toEqual({ status: 'short', available: TEAM_PLAYER_COUNT - 1, partial: 0, voice: 0, pending: 0, window: null });
  });

  it('is short when not even a voice table can meet', () => {
    expect(assessTeamAvailability(answers(['AVAILABLE', 1], ['VOICE_ONLY', 2], ['UNAVAILABLE', 3])).status).toBe('short');
  });

  it('is short when the silent players could not complete anything anyway', () => {
    expect(assessTeamAvailability(answers(['AVAILABLE', 1], ['UNAVAILABLE', 3], [null, TEAM_PLAYER_COUNT - 2])).status).toBe('short');
    expect(assessTeamAvailability(answers([null, TEAM_PLAYER_COUNT - 1])).status).toBe('short');
    expect(assessTeamAvailability([]).status).toBe('short');
  });

  it('is unknown while nothing is sure and the silent players could still fill a table: silence is not a no', () => {
    expect(assessTeamAvailability(answers([null, 5])))
      .toEqual({ status: 'unknown', available: 0, partial: 0, voice: 0, pending: 5, window: null });
    expect(assessTeamAvailability(answers(['AVAILABLE', 1], [null, 5])).status).toBe('unknown');
    expect(assessTeamAvailability(answers(['UNAVAILABLE', 1], [null, TEAM_PLAYER_COUNT])).status).toBe('unknown');
    expect(assessTeamAvailability(answers(['AVAILABLE', TEAM_PLAYER_COUNT - 1], ['UNAVAILABLE', 1], [null, 1])).status).toBe('unknown');
  });

  it('is voice as soon as a voice table is sure, whatever the silent players may add', () => {
    expect(assessTeamAvailability(answers(['VOICE_ONLY', TEAM_PLAYER_COUNT], [null, TEAM_PLAYER_COUNT])).status).toBe('voice');
    expect(assessTeamAvailability([...answers(['AVAILABLE', 2], ['VOICE_ONLY', 1], [null, 2]), partial(null, '19:00')]).status).toBe('voice');
  });

  it('is unknown while silent players could still fill the voice table', () => {
    expect(assessTeamAvailability(answers(['AVAILABLE', 1], ['VOICE_ONLY', 2], ['UNAVAILABLE', 2], [null, 1])).status).toBe('unknown');
  });
});

describe('isValidAvailabilityHours', () => {
  it('takes a start, an end or both, the end after the start', () => {
    expect(isValidAvailabilityHours({ startTime: '20:00', endTime: '23:00' })).toBe(true);
    expect(isValidAvailabilityHours({ startTime: '21:30', endTime: null })).toBe(true);
    expect(isValidAvailabilityHours({ startTime: null, endTime: '22:00' })).toBe(true);
  });

  it('refuses no hours at all, an end before its start, a time that does not exist, and anything else', () => {
    expect(isValidAvailabilityHours({ startTime: null, endTime: null })).toBe(false);
    expect(isValidAvailabilityHours({ startTime: '23:00', endTime: '20:00' })).toBe(false);
    expect(isValidAvailabilityHours({ startTime: '21:00', endTime: '21:00' })).toBe(false);
    expect(isValidAvailabilityHours({ startTime: '25:00', endTime: null })).toBe(false);
    expect(isValidAvailabilityHours({ startTime: '9:00', endTime: null })).toBe(false);
    expect(isValidAvailabilityHours({ startTime: '21:00' })).toBe(false);
    expect(isValidAvailabilityHours(null)).toBe(false);
    expect(isValidAvailabilityHours('20:00-23:00')).toBe(false);
  });
});

describe('formatAvailabilityHours and describeAvailabilityHours', () => {
  it('put hours in a few characters, and in a sentence', () => {
    expect(formatAvailabilityHours({ startTime: '20:00', endTime: '23:00' })).toBe('20:00 – 23:00');
    expect(formatAvailabilityHours({ startTime: '21:00', endTime: null })).toBe('dès 21:00');
    expect(formatAvailabilityHours({ startTime: null, endTime: '22:00' })).toBe('jusqu\'à 22:00');
    expect(describeAvailabilityHours({ startTime: '20:00', endTime: '23:00' })).toBe('de 20:00 à 23:00');
    expect(describeAvailabilityHours({ startTime: '21:00', endTime: null })).toBe('à partir de 21:00');
    expect(describeAvailabilityHours({ startTime: null, endTime: '22:00' })).toBe('jusqu\'à 22:00');
  });
});

describe('windowCovers', () => {
  it('covers a stretch inside the hours, a bound left out reaching the start or the end of the day', () => {
    expect(windowCovers({ startTime: '21:00', endTime: '23:00' }, { startTime: '21:00', endTime: '21:40' })).toBe(true);
    expect(windowCovers({ startTime: '21:00', endTime: '23:00' }, { startTime: '20:40', endTime: '21:20' })).toBe(false);
    expect(windowCovers({ startTime: '21:00', endTime: '23:00' }, { startTime: '22:40', endTime: '23:20' })).toBe(false);
    expect(windowCovers({ startTime: '21:00', endTime: null }, { startTime: '23:20', endTime: '24:00' })).toBe(true);
    expect(windowCovers({ startTime: null, endTime: '22:00' }, { startTime: '14:00', endTime: '14:40' })).toBe(true);
  });
});
