/**
 * Balance Rules Tests
 *
 * Tests for balance rules system:
 * - checkMapBalance function with different rules
 * - Rule severity (ERROR vs WARNING)
 * - Rule parameters
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MapConfig, BalanceRule } from '@shared/types';
import {
  checkMapBalance,
  setBalanceRules,
  getPlayerAssignments,
  getPlayerMainAssignment,
  getAssignmentPlayers,
} from '@/utils/balance';

// Mock players API
vi.mock('@/api/players.api', () => ({
  getPlayers: vi.fn(() => [
    { id: 'player-1', name: 'Alice' },
    { id: 'player-2', name: 'Bob' },
    { id: 'player-3', name: 'Charlie' },
    { id: 'player-4', name: 'David' },
  ]),
}));

describe('Balance Rules System', () => {
  const createMockMap = (overrides?: Partial<MapConfig>): MapConfig => ({
    id: 'test-map',
    name: 'Test Map',
    images: ['/test.png'],
    assignments: [
      { id: 1, name: 'Front', x: 25, y: 25 },
      { id: 2, name: 'Back', x: 75, y: 25 },
      { id: 3, name: 'Left', x: 25, y: 75 },
      { id: 4, name: 'Right', x: 75, y: 75 },
    ],
    players: [
      { playerId: 'player-1', assignmentIds: [1, 2] },
      { playerId: 'player-2', assignmentIds: [2, 3] },
      { playerId: 'player-3', assignmentIds: [3, 4] },
      { playerId: 'player-4', assignmentIds: [1, 4] },
    ],
    ...overrides,
  });

  const createDefaultRules = (): BalanceRule[] => [
    {
      id: 'rule-1',
      teamId: 'team-1',
      ruleKey: 'MIN_PLAYERS_PER_ROLE',
      name: 'Joueurs minimum par rôle',
      description: 'Chaque rôle doit avoir un minimum de joueurs',
      enabled: true,
      severity: 'ERROR',
      params: { minPlayers: 2 },
    },
    {
      id: 'rule-2',
      teamId: 'team-1',
      ruleKey: 'MIN_ROLES_PER_PLAYER',
      name: 'Rôles minimum par joueur',
      description: 'Chaque joueur doit avoir un minimum de rôles',
      enabled: true,
      severity: 'ERROR',
      params: { minRoles: 2 },
    },
    {
      id: 'rule-3',
      teamId: 'team-1',
      ruleKey: 'MAX_ROLES_PER_PLAYER',
      name: 'Rôles maximum par joueur',
      description: 'Chaque joueur ne peut pas avoir plus de X rôles',
      enabled: true,
      severity: 'WARNING',
      params: { maxRoles: 3 },
    },
    {
      id: 'rule-4',
      teamId: 'team-1',
      ruleKey: 'NO_DUPLICATE_PAIRS',
      name: 'Pas de paires dupliquées',
      description: 'Deux rôles ne peuvent pas être couverts par la même paire',
      enabled: true,
      severity: 'ERROR',
      params: {},
    },
  ];

  beforeEach(() => {
    setBalanceRules(createDefaultRules());
  });

  describe('checkMapBalance - Basic validation', () => {
    it('should return balanced for a well-configured map', () => {
      const map = createMockMap();
      const result = checkMapBalance(map);

      expect(result.isBalanced).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors when a role has no players', () => {
      const map = createMockMap({
        players: [
          { playerId: 'player-1', assignmentIds: [1, 2] },
          { playerId: 'player-2', assignmentIds: [2, 3] },
          // No one assigned to role 4
        ],
      });

      const result = checkMapBalance(map);

      expect(result.isBalanced).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('Right'))).toBe(true);
    });

    it('should return errors when a player has too few roles', () => {
      const map = createMockMap({
        players: [
          { playerId: 'player-1', assignmentIds: [1] }, // Only 1 role
          { playerId: 'player-2', assignmentIds: [2, 3] },
          { playerId: 'player-3', assignmentIds: [3, 4] },
          { playerId: 'player-4', assignmentIds: [1, 4] },
        ],
      });

      const result = checkMapBalance(map);

      expect(result.isBalanced).toBe(false);
      expect(result.errors.some(e => e.message.includes('Alice'))).toBe(true);
    });
  });

  describe('checkMapBalance - Severity levels', () => {
    it('should categorize ERROR rules as errors', () => {
      const map = createMockMap({
        players: [
          { playerId: 'player-1', assignmentIds: [1] }, // Too few roles = ERROR
          { playerId: 'player-2', assignmentIds: [2, 3] },
          { playerId: 'player-3', assignmentIds: [3, 4] },
          { playerId: 'player-4', assignmentIds: [1, 4] },
        ],
      });

      const result = checkMapBalance(map);

      expect(result.isBalanced).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].severity).toBe('ERROR');
    });

    it('should categorize WARNING rules as warnings', () => {
      // Set MAX_ROLES_PER_PLAYER to 2 and give a player 3 roles
      const rules = createDefaultRules();
      const maxRolesRule = rules.find(r => r.ruleKey === 'MAX_ROLES_PER_PLAYER')!;
      maxRolesRule.params = { maxRoles: 2 };
      setBalanceRules(rules);

      const map = createMockMap({
        players: [
          { playerId: 'player-1', assignmentIds: [1, 2, 3] }, // 3 roles = warning
          { playerId: 'player-2', assignmentIds: [2, 3] },
          { playerId: 'player-3', assignmentIds: [3, 4] },
          { playerId: 'player-4', assignmentIds: [1, 4] },
        ],
      });

      const result = checkMapBalance(map);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].severity).toBe('WARNING');
    });

    it('should return isBalanced=true even with warnings', () => {
      const rules = createDefaultRules();
      const maxRolesRule = rules.find(r => r.ruleKey === 'MAX_ROLES_PER_PLAYER')!;
      maxRolesRule.params = { maxRoles: 1 };
      setBalanceRules(rules);

      const map = createMockMap(); // All players have 2 roles = warnings

      const result = checkMapBalance(map);

      // Should still be balanced (errors=0) even with warnings
      expect(result.isBalanced).toBe(true);
      expect(result.hasWarnings).toBe(true);
    });
  });

  describe('checkMapBalance - Disabled rules', () => {
    it('should ignore disabled rules', () => {
      const rules = createDefaultRules();
      // Disable MIN_ROLES_PER_PLAYER rule
      const minRolesRule = rules.find(r => r.ruleKey === 'MIN_ROLES_PER_PLAYER')!;
      minRolesRule.enabled = false;
      setBalanceRules(rules);

      const map = createMockMap({
        players: [
          { playerId: 'player-1', assignmentIds: [1] }, // Only 1 role, but rule disabled
          { playerId: 'player-2', assignmentIds: [2, 3] },
          { playerId: 'player-3', assignmentIds: [3, 4] },
          { playerId: 'player-4', assignmentIds: [1, 4] },
        ],
      });

      const result = checkMapBalance(map);

      // MIN_ROLES_PER_PLAYER is disabled, so no error for player-1
      const minRolesErrors = result.errors.filter(e => e.ruleKey === 'MIN_ROLES_PER_PLAYER');
      expect(minRolesErrors).toHaveLength(0);
    });
  });

  describe('checkMapBalance - Rule parameters', () => {
    it('should use configured minPlayers parameter', () => {
      const rules = createDefaultRules();
      const minPlayersRule = rules.find(r => r.ruleKey === 'MIN_PLAYERS_PER_ROLE')!;
      minPlayersRule.params = { minPlayers: 3 }; // Require 3 players per role
      setBalanceRules(rules);

      const map = createMockMap(); // Each role has 2 players

      const result = checkMapBalance(map);

      expect(result.isBalanced).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should use configured minRoles parameter', () => {
      const rules = createDefaultRules();
      const minRolesRule = rules.find(r => r.ruleKey === 'MIN_ROLES_PER_PLAYER')!;
      minRolesRule.params = { minRoles: 3 }; // Require 3 roles per player
      setBalanceRules(rules);

      const map = createMockMap(); // Each player has 2 roles

      const result = checkMapBalance(map);

      expect(result.isBalanced).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should use configured maxRoles parameter', () => {
      const rules = createDefaultRules();
      const maxRolesRule = rules.find(r => r.ruleKey === 'MAX_ROLES_PER_PLAYER')!;
      maxRolesRule.params = { maxRoles: 1 }; // Max 1 role per player
      setBalanceRules(rules);

      const map = createMockMap(); // Each player has 2 roles

      const result = checkMapBalance(map);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings.length).toBe(4); // All 4 players exceed limit
    });
  });

  describe('checkMapBalance - Duplicate pairs detection', () => {
    it('should detect duplicate pairs', () => {
      const map = createMockMap({
        players: [
          { playerId: 'player-1', assignmentIds: [1, 2] }, // Covers Front and Back
          { playerId: 'player-2', assignmentIds: [1, 2] }, // Same pair for Front and Back
          { playerId: 'player-3', assignmentIds: [3, 4] },
          { playerId: 'player-4', assignmentIds: [3, 4] },
        ],
      });

      const result = checkMapBalance(map);

      expect(result.isBalanced).toBe(false);
      expect(result.errors.some(e => e.ruleKey === 'NO_DUPLICATE_PAIRS')).toBe(true);
    });
  });

  describe('Helper functions', () => {
    const mockMap = createMockMap();

    describe('getPlayerAssignments', () => {
      it('should return assignment IDs for a known player', () => {
        const result = getPlayerAssignments(mockMap, 'player-1');
        expect(result).toEqual([1, 2]);
      });

      it('should return empty array for unknown player', () => {
        const result = getPlayerAssignments(mockMap, 'unknown');
        expect(result).toEqual([]);
      });
    });

    describe('getPlayerMainAssignment', () => {
      it('should return main assignment when defined', () => {
        const mapWithMain = createMockMap({
          players: [
            { playerId: 'player-1', assignmentIds: [1, 2], mainAssignmentId: 1 },
          ],
        });
        const result = getPlayerMainAssignment(mapWithMain, 'player-1');
        expect(result).toBe(1);
      });

      it('should return null when no main assignment', () => {
        const result = getPlayerMainAssignment(mockMap, 'player-1');
        expect(result).toBeNull();
      });
    });

    describe('getAssignmentPlayers', () => {
      it('should return player IDs for a given assignment', () => {
        const result = getAssignmentPlayers(mockMap, 1);
        expect(result).toContain('player-1');
        expect(result).toContain('player-4');
        expect(result).toHaveLength(2);
      });

      it('should return empty array for unused assignment', () => {
        const mapWithUnused = createMockMap({
          assignments: [
            ...createMockMap().assignments,
            { id: 99, name: 'Unused', x: 50, y: 50 },
          ],
        });
        const result = getAssignmentPlayers(mapWithUnused, 99);
        expect(result).toEqual([]);
      });
    });
  });
});
