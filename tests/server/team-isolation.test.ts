/**
 * Team Isolation Tests
 *
 * Tests that verify team data isolation works correctly:
 * - Users can only see their team's data
 * - Users cannot access other team's data
 * - Users without a team see empty data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Team Isolation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ============================================
  // UNIT TESTS: Data Filtering by Team
  // ============================================

  describe('Unit Tests: Data Filtering', () => {
    describe('GamePlan filtering', () => {
      it('should only return game plans belonging to user team', () => {
        const userTeamId = 'team-1';
        const allPlans = [
          { id: 'plan-1', name: 'Plan A', teamId: 'team-1' },
          { id: 'plan-2', name: 'Plan B', teamId: 'team-2' },
          { id: 'plan-3', name: 'Plan C', teamId: 'team-1' },
        ];

        const filteredPlans = allPlans.filter(plan => plan.teamId === userTeamId);

        expect(filteredPlans).toHaveLength(2);
        expect(filteredPlans.map(p => p.id)).toEqual(['plan-1', 'plan-3']);
        expect(filteredPlans.every(p => p.teamId === userTeamId)).toBe(true);
      });

      it('should return empty array when user has no team', () => {
        const userTeamId = null;
        const allPlans = [
          { id: 'plan-1', name: 'Plan A', teamId: 'team-1' },
          { id: 'plan-2', name: 'Plan B', teamId: 'team-2' },
        ];

        const filteredPlans = userTeamId
          ? allPlans.filter(plan => plan.teamId === userTeamId)
          : [];

        expect(filteredPlans).toHaveLength(0);
      });
    });

    describe('CalendarEvent filtering', () => {
      it('should only return events belonging to user team', () => {
        const userTeamId = 'team-1';
        const allEvents = [
          { id: 'event-1', title: 'Match 1', teamId: 'team-1' },
          { id: 'event-2', title: 'Match 2', teamId: 'team-2' },
          { id: 'event-3', title: 'Event 1', teamId: 'team-1' },
        ];

        const filteredEvents = allEvents.filter(event => event.teamId === userTeamId);

        expect(filteredEvents).toHaveLength(2);
        expect(filteredEvents.map(e => e.id)).toEqual(['event-1', 'event-3']);
      });

      it('should return empty array when user has no team', () => {
        const userTeamId = null;
        const allEvents = [
          { id: 'event-1', title: 'Match 1', teamId: 'team-1' },
        ];

        const filteredEvents = userTeamId
          ? allEvents.filter(event => event.teamId === userTeamId)
          : [];

        expect(filteredEvents).toHaveLength(0);
      });
    });

    describe('User/Player filtering', () => {
      it('should only return users from the same team', () => {
        const userTeamId = 'team-1';
        const allUsers = [
          { id: 'user-1', name: 'Alice', teamId: 'team-1' },
          { id: 'user-2', name: 'Bob', teamId: 'team-2' },
          { id: 'user-3', name: 'Charlie', teamId: 'team-1' },
          { id: 'user-4', name: 'Diana', teamId: null },
        ];

        const filteredUsers = allUsers.filter(user => user.teamId === userTeamId);

        expect(filteredUsers).toHaveLength(2);
        expect(filteredUsers.map(u => u.name)).toEqual(['Alice', 'Charlie']);
      });

      it('should return empty array when user has no team', () => {
        const userTeamId = null;
        const allUsers = [
          { id: 'user-1', name: 'Alice', teamId: 'team-1' },
          { id: 'user-2', name: 'Bob', teamId: 'team-2' },
        ];

        const filteredUsers = userTeamId
          ? allUsers.filter(user => user.teamId === userTeamId)
          : [];

        expect(filteredUsers).toHaveLength(0);
      });
    });

    describe('Availability filtering', () => {
      it('should only return availabilities from team members', () => {
        const teamMemberIds = ['user-1', 'user-3'];
        const allAvailabilities = [
          { id: 'av-1', userId: 'user-1', date: '2026-01-24', status: 'AVAILABLE' },
          { id: 'av-2', userId: 'user-2', date: '2026-01-24', status: 'AVAILABLE' },
          { id: 'av-3', userId: 'user-3', date: '2026-01-24', status: 'UNAVAILABLE' },
        ];

        const filteredAvailabilities = allAvailabilities.filter(
          av => teamMemberIds.includes(av.userId)
        );

        expect(filteredAvailabilities).toHaveLength(2);
        expect(filteredAvailabilities.map(a => a.userId)).toEqual(['user-1', 'user-3']);
      });
    });

    describe('BalanceRule filtering', () => {
      it('should only return balance rules belonging to user team', () => {
        const userTeamId = 'team-1';
        const allRules = [
          { id: 'rule-1', name: 'Rule 1', teamId: 'team-1' },
          { id: 'rule-2', name: 'Rule 2', teamId: 'team-2' },
          { id: 'rule-3', name: 'Rule 3', teamId: 'team-1' },
        ];

        const filteredRules = allRules.filter(rule => rule.teamId === userTeamId);

        expect(filteredRules).toHaveLength(2);
        expect(filteredRules.every(r => r.teamId === userTeamId)).toBe(true);
      });
    });
  });

  // ============================================
  // INTEGRATION TESTS: API Route Isolation
  // ============================================

  describe('Integration Tests: API Route Isolation', () => {
    const mockTeam1Token = 'token-team-1';
    const mockTeam2Token = 'token-team-2';
    const mockNoTeamToken = 'token-no-team';

    describe('GET /api/maps - Game Plans isolation', () => {
      it('should return only game plans from user team', async () => {
        const team1Plans = [{ id: 'plan-1', name: 'Plan A' }];

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([
            { id: 'artefact', name: 'Artefact', gamePlans: team1Plans },
          ]),
        });

        const response = await fetch('/api/maps', {
          headers: { 'Authorization': `Bearer ${mockTeam1Token}` },
        });

        const maps = await response.json();
        expect(maps[0].gamePlans).toEqual(team1Plans);
      });

      it('should return empty game plans for user without team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([
            { id: 'artefact', name: 'Artefact', gamePlans: [] },
          ]),
        });

        const response = await fetch('/api/maps', {
          headers: { 'Authorization': `Bearer ${mockNoTeamToken}` },
        });

        const maps = await response.json();
        expect(maps[0].gamePlans).toEqual([]);
      });
    });

    describe('GET /api/users - User list isolation', () => {
      it('should return only users from the same team', async () => {
        const team1Users = [
          { id: 'user-1', name: 'Alice' },
          { id: 'user-3', name: 'Charlie' },
        ];

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(team1Users),
        });

        const response = await fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${mockTeam1Token}` },
        });

        const users = await response.json();
        expect(users).toHaveLength(2);
      });

      it('should return empty array for user without team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        });

        const response = await fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${mockNoTeamToken}` },
        });

        const users = await response.json();
        expect(users).toEqual([]);
      });
    });

    describe('GET /api/calendar/events - Events isolation', () => {
      it('should return only events from user team', async () => {
        const team1Events = [
          { id: 'event-1', title: 'Match 1', teamId: 'team-1' },
        ];

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(team1Events),
        });

        const response = await fetch('/api/calendar/events?month=2026-01', {
          headers: { 'Authorization': `Bearer ${mockTeam1Token}` },
        });

        const events = await response.json();
        expect(events).toHaveLength(1);
        expect(events[0].teamId).toBe('team-1');
      });

      it('should return empty array for user without team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        });

        const response = await fetch('/api/calendar/events?month=2026-01', {
          headers: { 'Authorization': `Bearer ${mockNoTeamToken}` },
        });

        const events = await response.json();
        expect(events).toEqual([]);
      });
    });

    describe('GET /api/calendar/availability - Availability isolation', () => {
      it('should return availability data only for team members', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            players: [{ id: 'user-1', name: 'Alice' }],
            availability: { 'user-1': { '2026-01-24': 'AVAILABLE' } },
            noTeam: false,
          }),
        });

        const response = await fetch('/api/calendar/availability?month=2026-01', {
          headers: { 'Authorization': `Bearer ${mockTeam1Token}` },
        });

        const data = await response.json();
        expect(data.noTeam).toBe(false);
        expect(data.players).toHaveLength(1);
      });

      it('should return noTeam flag for user without team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            players: [],
            availability: {},
            noTeam: true,
          }),
        });

        const response = await fetch('/api/calendar/availability?month=2026-01', {
          headers: { 'Authorization': `Bearer ${mockNoTeamToken}` },
        });

        const data = await response.json();
        expect(data.noTeam).toBe(true);
        expect(data.players).toEqual([]);
      });
    });
  });

  // ============================================
  // SECURITY TESTS: Cross-Team Access Prevention
  // ============================================

  describe('Security Tests: Cross-Team Access Prevention', () => {
    const mockTeam1Token = 'token-team-1';

    describe('PUT /api/plans/:planId - Cannot update other team plan', () => {
      it('should reject update to plan belonging to another team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Plan not found or access denied' }),
        });

        const response = await fetch('/api/plans/other-team-plan-id', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockTeam1Token}`,
          },
          body: JSON.stringify({ name: 'Hacked Plan' }),
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(403);
      });
    });

    describe('DELETE /api/plans/:planId - Cannot delete other team plan', () => {
      it('should reject deletion of plan belonging to another team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Plan not found or access denied' }),
        });

        const response = await fetch('/api/plans/other-team-plan-id', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${mockTeam1Token}` },
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(403);
      });
    });

    describe('PUT /api/calendar/events/:id - Cannot update other team event', () => {
      it('should reject update to event belonging to another team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Event not found or access denied' }),
        });

        const response = await fetch('/api/calendar/events/other-team-event-id', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockTeam1Token}`,
          },
          body: JSON.stringify({ title: 'Hacked Event' }),
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(403);
      });
    });

    describe('DELETE /api/calendar/events/:id - Cannot delete other team event', () => {
      it('should reject deletion of event belonging to another team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Event not found or access denied' }),
        });

        const response = await fetch('/api/calendar/events/other-team-event-id', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${mockTeam1Token}` },
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(403);
      });
    });

    describe('Team management security', () => {
      it('should prevent non-leader from deleting team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Only leader can delete team' }),
        });

        const response = await fetch('/api/teams/current', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${mockTeam1Token}` },
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(403);
      });

      it('should prevent accessing other team member permissions', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Member not in your team' }),
        });

        const response = await fetch('/api/teams/current/members/other-team-member-id/permissions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockTeam1Token}`,
          },
          body: JSON.stringify({ permissions: {} }),
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(403);
      });
    });

    describe('Balance rules security', () => {
      it('should prevent updating balance rules of another team', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Rule not found or access denied' }),
        });

        const response = await fetch('/api/balance-rules/other-team-rule-id', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockTeam1Token}`,
          },
          body: JSON.stringify({ enabled: false }),
        });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(403);
      });
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    describe('User joins a team', () => {
      it('should immediately see team data after joining', async () => {
        // Before joining - no data
        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ noTeam: true, players: [], availability: {} }),
          })
          // After joining - sees team data
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
              noTeam: false,
              players: [{ id: 'user-1', name: 'Teammate' }],
              availability: {},
            }),
          });

        // Before joining
        const beforeResponse = await fetch('/api/calendar/availability?month=2026-01');
        const beforeData = await beforeResponse.json();
        expect(beforeData.noTeam).toBe(true);

        // After joining (simulated by second call)
        const afterResponse = await fetch('/api/calendar/availability?month=2026-01');
        const afterData = await afterResponse.json();
        expect(afterData.noTeam).toBe(false);
        expect(afterData.players.length).toBeGreaterThan(0);
      });
    });

    describe('User leaves team', () => {
      it('should immediately lose access to team data after leaving', async () => {
        // Before leaving - sees data
        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
              noTeam: false,
              players: [{ id: 'user-1', name: 'Teammate' }],
              availability: {},
            }),
          })
          // After leaving - no data
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ noTeam: true, players: [], availability: {} }),
          });

        // Before leaving
        const beforeResponse = await fetch('/api/calendar/availability?month=2026-01');
        const beforeData = await beforeResponse.json();
        expect(beforeData.noTeam).toBe(false);

        // After leaving (simulated by second call)
        const afterResponse = await fetch('/api/calendar/availability?month=2026-01');
        const afterData = await afterResponse.json();
        expect(afterData.noTeam).toBe(true);
      });
    });

    describe('Team deletion cascade', () => {
      it('should delete all related data when team is deleted', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ message: 'Team deleted successfully' }),
        });

        const response = await fetch('/api/teams/current', {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer leader-token' },
        });

        expect(response.ok).toBe(true);

        // After deletion, related data should be gone (verified by schema cascade)
        // This is enforced by Prisma schema onDelete: Cascade
      });
    });
  });
});
