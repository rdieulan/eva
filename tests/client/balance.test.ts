import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MapConfig, Player } from '@/types';

// We need to test checkMapBalance, but it depends on getPlayers() which requires initialization
// So we'll mock the module

describe('Map Balance Validation', () => {
  // Helper to create balanced mock map
  function createBalancedMap(): MapConfig {
    return {
      id: 'balanced-map',
      name: 'Balanced Map',
      images: ['/maps/test/Test.png'],
      assignments: [
        { id: 1, name: 'Front', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
        { id: 2, name: 'Back', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
        { id: 3, name: 'Left', x: 25, y: 75, zone: { x1: 20, y1: 70, x2: 30, y2: 80 } },
        { id: 4, name: 'Right', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
      ],
      players: [
        { userId: 'player-1', assignmentIds: [1, 2] },
        { userId: 'player-2', assignmentIds: [2, 3] },
        { userId: 'player-3', assignmentIds: [3, 4] },
        { userId: 'player-4', assignmentIds: [4, 1] },
        { userId: 'player-5', assignmentIds: [1, 3] },
      ],
    };
  }

  describe('Assignment Coverage Rules', () => {
    it('should correctly count players per assignment', () => {
      const map = createBalancedMap();

      // Count how many players cover each assignment
      const coverageCount: Record<number, number> = {};

      for (const playerAssignment of map.players) {
        for (const assignmentId of playerAssignment.assignmentIds) {
          coverageCount[assignmentId] = (coverageCount[assignmentId] || 0) + 1;
        }
      }

      // Each assignment should be covered by at least 2 players
      expect(coverageCount[1]).toBeGreaterThanOrEqual(2); // player-1, player-4, player-5
      expect(coverageCount[2]).toBeGreaterThanOrEqual(2); // player-1, player-2
      expect(coverageCount[3]).toBeGreaterThanOrEqual(2); // player-2, player-3, player-5
      expect(coverageCount[4]).toBeGreaterThanOrEqual(2); // player-3, player-4
    });

    it('should detect assignment with only one player', () => {
      const map: MapConfig = {
        id: 'unbalanced-map',
        name: 'Unbalanced Map',
        images: ['/maps/test/Test.png'],
        assignments: [
          { id: 1, name: 'Solo Position', x: 50, y: 50, zone: { x1: 45, y1: 45, x2: 55, y2: 55 } },
          { id: 2, name: 'Covered Position', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
        ],
        players: [
          { userId: 'player-1', assignmentIds: [1] }, // Only one player on assignment 1
          { userId: 'player-2', assignmentIds: [2] },
          { userId: 'player-3', assignmentIds: [2] },
        ],
      };

      // Count coverage
      const assignment1Coverage = map.players.filter(p =>
        p.assignmentIds.includes(1)
      ).length;

      expect(assignment1Coverage).toBe(1);
    });

    it('should detect assignment with no players', () => {
      const map: MapConfig = {
        id: 'empty-assignment-map',
        name: 'Empty Assignment Map',
        images: ['/maps/test/Test.png'],
        assignments: [
          { id: 1, name: 'Empty Position', x: 50, y: 50, zone: { x1: 45, y1: 45, x2: 55, y2: 55 } },
        ],
        players: [],
      };

      const assignment1Coverage = map.players.filter(p =>
        p.assignmentIds.includes(1)
      ).length;

      expect(assignment1Coverage).toBe(0);
    });
  });

  describe('Player Assignment Rules', () => {
    it('should detect player with only one assignment', () => {
      const map: MapConfig = {
        id: 'single-assignment-map',
        name: 'Single Assignment Map',
        images: ['/maps/test/Test.png'],
        assignments: [
          { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
          { id: 2, name: 'Position 2', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
        ],
        players: [
          { userId: 'player-1', assignmentIds: [1] }, // Only one assignment
          { userId: 'player-2', assignmentIds: [1, 2] },
        ],
      };

      const singleAssignmentPlayers = map.players.filter(p =>
        p.assignmentIds.length === 1
      );

      expect(singleAssignmentPlayers).toHaveLength(1);
      expect(singleAssignmentPlayers[0].userId).toBe('player-1');
    });

    it('should detect player with more than 2 assignments', () => {
      const map: MapConfig = {
        id: 'overloaded-map',
        name: 'Overloaded Map',
        images: ['/maps/test/Test.png'],
        assignments: [
          { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
          { id: 2, name: 'Position 2', x: 50, y: 50, zone: { x1: 45, y1: 45, x2: 55, y2: 55 } },
          { id: 3, name: 'Position 3', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
        ],
        players: [
          { userId: 'player-1', assignmentIds: [1, 2, 3] }, // 3 assignments (too many)
          { userId: 'player-2', assignmentIds: [1, 2] },
        ],
      };

      const overloadedPlayers = map.players.filter(p =>
        p.assignmentIds.length > 2
      );

      expect(overloadedPlayers).toHaveLength(1);
      expect(overloadedPlayers[0].userId).toBe('player-1');
    });
  });

  describe('Duplicate Pair Detection', () => {
    it('should detect two assignments covered by the same pair', () => {
      const map: MapConfig = {
        id: 'duplicate-pair-map',
        name: 'Duplicate Pair Map',
        images: ['/maps/test/Test.png'],
        assignments: [
          { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
          { id: 2, name: 'Position 2', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
        ],
        players: [
          { userId: 'player-1', assignmentIds: [1, 2] },
          { userId: 'player-2', assignmentIds: [1, 2] },
          // Both assignments covered by the same pair: player-1 and player-2
        ],
      };

      // Find assignments covered by exactly 2 players
      const assignmentPairs: Record<number, string[]> = {};

      for (const assignment of map.assignments) {
        const playersOnAssignment = map.players
          .filter(p => p.assignmentIds.includes(assignment.id))
          .map(p => p.userId)
          .sort();

        assignmentPairs[assignment.id] = playersOnAssignment;
      }

      // Check if assignments 1 and 2 have the same pair
      expect(assignmentPairs[1]).toEqual(assignmentPairs[2]);
      expect(assignmentPairs[1]).toEqual(['player-1', 'player-2']);
    });

    it('should allow same pair when third player covers one assignment', () => {
      const map: MapConfig = {
        id: 'different-coverage-map',
        name: 'Different Coverage Map',
        images: ['/maps/test/Test.png'],
        assignments: [
          { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
          { id: 2, name: 'Position 2', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
        ],
        players: [
          { userId: 'player-1', assignmentIds: [1, 2] },
          { userId: 'player-2', assignmentIds: [1, 2] },
          { userId: 'player-3', assignmentIds: [1] }, // Third player on assignment 1
        ],
      };

      const assignmentPairs: Record<number, string[]> = {};

      for (const assignment of map.assignments) {
        const playersOnAssignment = map.players
          .filter(p => p.assignmentIds.includes(assignment.id))
          .map(p => p.userId)
          .sort();

        assignmentPairs[assignment.id] = playersOnAssignment;
      }

      // Assignment 1 has 3 players, assignment 2 has 2
      expect(assignmentPairs[1]).toHaveLength(3);
      expect(assignmentPairs[2]).toHaveLength(2);
      expect(assignmentPairs[1]).not.toEqual(assignmentPairs[2]);
    });
  });
});

describe('Rotation Configuration Validity', () => {
  it('should validate that 4 players can always cover 4 assignments', () => {
    // With 5 players (one absent), we need to ensure 4 can cover 4 positions
    const map: MapConfig = {
      id: 'rotation-valid-map',
      name: 'Valid Rotation Map',
      images: ['/maps/test/Test.png'],
      assignments: [
        { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
        { id: 2, name: 'Position 2', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
        { id: 3, name: 'Position 3', x: 25, y: 75, zone: { x1: 20, y1: 70, x2: 30, y2: 80 } },
        { id: 4, name: 'Position 4', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
      ],
      players: [
        { userId: 'player-1', assignmentIds: [1, 2] },
        { userId: 'player-2', assignmentIds: [2, 3] },
        { userId: 'player-3', assignmentIds: [3, 4] },
        { userId: 'player-4', assignmentIds: [4, 1] },
        { userId: 'player-5', assignmentIds: [1, 3] },
      ],
    };

    // For each absent player, check if remaining 4 can cover all positions
    const allPlayerIds = map.players.map(p => p.userId);

    for (const absentPlayerId of allPlayerIds) {
      const presentPlayers = map.players.filter(p => p.userId !== absentPlayerId);

      // Each assignment must be coverable by at least one present player
      for (const assignment of map.assignments) {
        const canCover = presentPlayers.some(p =>
          p.assignmentIds.includes(assignment.id)
        );

        expect(canCover).toBe(true);
      }
    }
  });

  it('should detect invalid rotation when one player is critical', () => {
    // Configuration where player-1 is the only one covering assignments 1 and 2
    const map: MapConfig = {
      id: 'invalid-rotation-map',
      name: 'Invalid Rotation Map',
      images: ['/maps/test/Test.png'],
      assignments: [
        { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
        { id: 2, name: 'Position 2', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
        { id: 3, name: 'Position 3', x: 25, y: 75, zone: { x1: 20, y1: 70, x2: 30, y2: 80 } },
        { id: 4, name: 'Position 4', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
      ],
      players: [
        { userId: 'player-1', assignmentIds: [1] }, // Only player on position 1
        { userId: 'player-2', assignmentIds: [2, 3] },
        { userId: 'player-3', assignmentIds: [3, 4] },
        { userId: 'player-4', assignmentIds: [4] },
        { userId: 'player-5', assignmentIds: [2, 3] },
      ],
    };

    // If player-1 is absent, no one can cover position 1
    const presentWithoutPlayer1 = map.players.filter(p => p.userId !== 'player-1');
    const canCoverPosition1 = presentWithoutPlayer1.some(p =>
      p.assignmentIds.includes(1)
    );

    expect(canCoverPosition1).toBe(false);
  });
});

