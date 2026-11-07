// Tests for reading stored permissions against the full set
import { describe, it, expect } from 'vitest';
import { normalizeAccountPermissions } from '@shared/utils';
import { DEFAULT_PLAYER_PERMISSIONS, LEADER_PERMISSIONS } from '@shared/types';

describe('normalizeAccountPermissions', () => {
  it('reads nothing stored as nothing granted', () => {
    expect(normalizeAccountPermissions(null)).toEqual(DEFAULT_PLAYER_PERMISSIONS);
    expect(normalizeAccountPermissions('nonsense')).toEqual(DEFAULT_PLAYER_PERMISSIONS);
  });

  it('keeps what was granted, and refuses a category added since, until it is granted', () => {
    // Saved before the matchmaking permissions existed
    const stored = {
      planner: { canCreate: true },
      calendar: { canCreateEvents: true, canEditEvents: false },
      team: { canInviteMembers: true },
    };

    const permissions = normalizeAccountPermissions(stored);

    expect(permissions.calendar).toEqual({ canCreateEvents: true, canEditEvents: false, canDeleteEvents: false, canAttachGamePlan: false });
    expect(permissions.matchmaking).toEqual({ canSearch: false, canPropose: false, canRespond: false });
    expect(permissions.team.canInviteMembers).toBe(true);
  });

  it('grants only what is stored as true, and leaves out what the app does not know', () => {
    const permissions = normalizeAccountPermissions({
      matchmaking: { canSearch: 'yes', canPropose: 1, canRespond: true },
      payments: { canSpend: true },
    });

    expect(permissions.matchmaking).toEqual({ canSearch: false, canPropose: false, canRespond: true });
    expect(Object.keys(permissions).sort()).toEqual(['calendar', 'matchmaking', 'planner', 'team']);
  });

  it('gives fresh categories, so editing a copy never touches the source', () => {
    const permissions = normalizeAccountPermissions(LEADER_PERMISSIONS);
    permissions.matchmaking.canSearch = false;

    expect(LEADER_PERMISSIONS.matchmaking.canSearch).toBe(true);
  });
});
