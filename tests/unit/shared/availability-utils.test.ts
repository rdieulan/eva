// Tests for the team-level availability read on a day
import { describe, it, expect } from 'vitest';
import { assessTeamAvailability } from '@shared/utils';
import { TEAM_PLAYER_COUNT } from '@shared/constants';
import type { AvailabilityStatus } from '@shared/types';

function statuses(...entries: Array<[AvailabilityStatus | null, number]>): Array<AvailabilityStatus | null> {
  return entries.flatMap(([status, count]) => Array<AvailabilityStatus | null>(count).fill(status));
}

describe('assessTeamAvailability', () => {
  it('is ready with a full lineup of available players', () => {
    expect(assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT])))
      .toEqual({ status: 'ready', available: TEAM_PLAYER_COUNT, conditional: 0, answered: TEAM_PLAYER_COUNT });
  });

  it('stays ready with more players than needed, whatever the others say', () => {
    const result = assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT + 1], ['UNAVAILABLE', 2], [null, 1]));
    expect(result.status).toBe('ready');
    expect(result.available).toBe(TEAM_PLAYER_COUNT + 1);
  });

  it('is shaky when the lineup needs a conditional player', () => {
    expect(assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT - 1], ['CONDITIONAL', 1])))
      .toEqual({ status: 'shaky', available: TEAM_PLAYER_COUNT - 1, conditional: 1, answered: TEAM_PLAYER_COUNT });
  });

  it('is shaky with a lineup made only of conditional players', () => {
    expect(assessTeamAvailability(statuses(['CONDITIONAL', TEAM_PLAYER_COUNT])).status).toBe('shaky');
  });

  it('is short when available and conditional players do not add up', () => {
    expect(assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT - 2], ['CONDITIONAL', 1])).status)
      .toBe('short');
  });

  it('does not count voice-only, unavailable or unset players', () => {
    const result = assessTeamAvailability(
      statuses(['AVAILABLE', TEAM_PLAYER_COUNT - 1], ['VOICE_ONLY', 3], ['UNAVAILABLE', 3], [null, 3]),
    );
    expect(result).toEqual({ status: 'short', available: TEAM_PLAYER_COUNT - 1, conditional: 0, answered: TEAM_PLAYER_COUNT + 5 });
  });

  it('is unknown while nobody has answered: silence is not a no', () => {
    expect(assessTeamAvailability([])).toEqual({ status: 'unknown', available: 0, conditional: 0, answered: 0 });
    expect(assessTeamAvailability(statuses([null, 5])).status).toBe('unknown');
  });

  it('is short as soon as one answer shows the lineup is not there', () => {
    expect(assessTeamAvailability(statuses(['UNAVAILABLE', 1], [null, 4])).status).toBe('short');
    expect(assessTeamAvailability(statuses(['AVAILABLE', 1], [null, 4])).status).toBe('short');
  });
});
