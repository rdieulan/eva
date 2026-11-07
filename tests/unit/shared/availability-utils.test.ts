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
      .toEqual({ status: 'ready', available: TEAM_PLAYER_COUNT, conditional: 0, voice: 0, pending: 0 });
  });

  it('stays ready with more players than needed, whatever the others say', () => {
    const result = assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT + 1], ['UNAVAILABLE', 2], [null, 1]));
    expect(result.status).toBe('ready');
    expect(result.available).toBe(TEAM_PLAYER_COUNT + 1);
  });

  it('is shaky when the lineup needs a conditional player', () => {
    expect(assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT - 1], ['CONDITIONAL', 1])))
      .toEqual({ status: 'shaky', available: TEAM_PLAYER_COUNT - 1, conditional: 1, voice: 0, pending: 0 });
  });

  it('is shaky with a lineup made only of conditional players', () => {
    expect(assessTeamAvailability(statuses(['CONDITIONAL', TEAM_PLAYER_COUNT])).status).toBe('shaky');
  });

  it('is voice when the arena is out of reach but a table can meet on voice chat', () => {
    expect(assessTeamAvailability(statuses(['VOICE_ONLY', TEAM_PLAYER_COUNT], ['UNAVAILABLE', 1])))
      .toEqual({ status: 'voice', available: 0, conditional: 0, voice: TEAM_PLAYER_COUNT, pending: 0 });
    // Players bound for the arena sit at the voice table too
    expect(assessTeamAvailability(statuses(['AVAILABLE', 1], ['CONDITIONAL', 1], ['VOICE_ONLY', TEAM_PLAYER_COUNT - 2], ['UNAVAILABLE', 2])).status)
      .toBe('voice');
  });

  it('is short once everyone has answered and the players do not add up', () => {
    expect(assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT - 2], ['CONDITIONAL', 1], ['UNAVAILABLE', 2])).status)
      .toBe('short');
  });

  it('does not count unavailable players', () => {
    const result = assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT - 1], ['UNAVAILABLE', 3]));
    expect(result).toEqual({ status: 'short', available: TEAM_PLAYER_COUNT - 1, conditional: 0, voice: 0, pending: 0 });
  });

  it('is short when not even a voice table can meet', () => {
    expect(assessTeamAvailability(statuses(['AVAILABLE', 1], ['VOICE_ONLY', 2], ['UNAVAILABLE', 3])).status).toBe('short');
  });

  it('is short when the silent players could not complete anything anyway', () => {
    expect(assessTeamAvailability(statuses(['AVAILABLE', 1], ['UNAVAILABLE', 3], [null, TEAM_PLAYER_COUNT - 2])).status).toBe('short');
    expect(assessTeamAvailability(statuses([null, TEAM_PLAYER_COUNT - 1])).status).toBe('short');
    expect(assessTeamAvailability([]).status).toBe('short');
  });

  it('is unknown while nothing is sure and the silent players could still fill a table: silence is not a no', () => {
    expect(assessTeamAvailability(statuses([null, 5])))
      .toEqual({ status: 'unknown', available: 0, conditional: 0, voice: 0, pending: 5 });
    expect(assessTeamAvailability(statuses(['AVAILABLE', 1], [null, 5])).status).toBe('unknown');
    expect(assessTeamAvailability(statuses(['UNAVAILABLE', 1], [null, TEAM_PLAYER_COUNT])).status).toBe('unknown');
    expect(assessTeamAvailability(statuses(['AVAILABLE', TEAM_PLAYER_COUNT - 1], ['UNAVAILABLE', 1], [null, 1])).status).toBe('unknown');
  });

  it('is voice as soon as a voice table is sure, whatever the silent players may add', () => {
    expect(assessTeamAvailability(statuses(['VOICE_ONLY', TEAM_PLAYER_COUNT], [null, TEAM_PLAYER_COUNT])).status).toBe('voice');
    expect(assessTeamAvailability(statuses(['AVAILABLE', 2], ['CONDITIONAL', 1], ['VOICE_ONLY', 1], [null, 2])).status).toBe('voice');
  });

  it('is unknown while silent players could still fill the voice table', () => {
    expect(assessTeamAvailability(statuses(['AVAILABLE', 1], ['VOICE_ONLY', 2], ['UNAVAILABLE', 2], [null, 1])).status).toBe('unknown');
  });
});
