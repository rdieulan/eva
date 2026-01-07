import { describe, it, expect } from 'vitest';
import type { MapConfig } from '@/types';

// Rotation Calculator Logic Tests
// These tests verify the rotation calculator can find valid configurations

interface RotationResult {
  mapId: string;
  configurations: PlayerConfiguration[];
  errors: string[];
}

interface PlayerConfiguration {
  [playerId: string]: number;
}

// Pure function to calculate valid configurations
function calculateValidConfigurations(
  map: MapConfig,
  absentPlayerId: string
): RotationResult {
  const presentPlayers = map.players.filter(p => p.userId !== absentPlayerId);
  const assignmentIds = map.assignments.map(a => a.id);
  const configurations: PlayerConfiguration[] = [];
  const errors: string[] = [];

  // Check if all assignments can be covered
  for (const assignment of map.assignments) {
    const canCover = presentPlayers.some(p => p.assignmentIds.includes(assignment.id));
    if (!canCover) {
      errors.push(`No player can cover ${assignment.name} when ${absentPlayerId} is absent`);
    }
  }

  if (errors.length > 0) {
    return { mapId: map.id, configurations: [], errors };
  }

  // Find all valid configurations using backtracking
  function findConfigurations(
    remainingAssignments: number[],
    currentConfig: PlayerConfiguration,
    usedPlayers: Set<string>
  ): void {
    if (remainingAssignments.length === 0) {
      configurations.push({ ...currentConfig });
      return;
    }

    const assignmentId = remainingAssignments[0];
    const nextAssignments = remainingAssignments.slice(1);

    const availablePlayers = presentPlayers.filter(p =>
      p.assignmentIds.includes(assignmentId) && !usedPlayers.has(p.userId)
    );

    for (const player of availablePlayers) {
      const newConfig = { ...currentConfig, [player.userId]: assignmentId };
      const newUsedPlayers = new Set(usedPlayers).add(player.userId);
      findConfigurations(nextAssignments, newConfig, newUsedPlayers);
    }
  }

  findConfigurations(assignmentIds, {}, new Set());

  return { mapId: map.id, configurations, errors };
}

describe('Rotation Calculator', () => {
  const mockMap: MapConfig = {
    id: 'test-map',
    name: 'Test Map',
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

  describe('Valid Configurations', () => {
    it('should find at least one valid configuration for each absent player', () => {
      const playerIds = mockMap.players.map(p => p.userId);

      for (const absentPlayerId of playerIds) {
        const result = calculateValidConfigurations(mockMap, absentPlayerId);

        expect(result.errors).toHaveLength(0);
        expect(result.configurations.length).toBeGreaterThan(0);
      }
    });

    it('should assign exactly 4 players to 4 assignments in each configuration', () => {
      const result = calculateValidConfigurations(mockMap, 'player-1');

      for (const config of result.configurations) {
        const assignedPlayers = Object.keys(config);
        const assignedAssignments = Object.values(config);

        expect(assignedPlayers).toHaveLength(4);
        expect(new Set(assignedAssignments).size).toBe(4);
      }
    });

    it('should only assign players to positions they can cover', () => {
      const result = calculateValidConfigurations(mockMap, 'player-1');

      for (const config of result.configurations) {
        for (const [playerId, assignmentId] of Object.entries(config)) {
          const player = mockMap.players.find(p => p.userId === playerId);
          expect(player?.assignmentIds).toContain(assignmentId);
        }
      }
    });

    it('should not include the absent player in configurations', () => {
      const absentPlayerId = 'player-3';
      const result = calculateValidConfigurations(mockMap, absentPlayerId);

      for (const config of result.configurations) {
        expect(Object.keys(config)).not.toContain(absentPlayerId);
      }
    });
  });

  describe('Error Detection', () => {
    it('should return errors when an assignment cannot be covered', () => {
      const problematicMap: MapConfig = {
        ...mockMap,
        players: [
          { userId: 'player-1', assignmentIds: [1] },
          { userId: 'player-2', assignmentIds: [2, 3] },
          { userId: 'player-3', assignmentIds: [3, 4] },
          { userId: 'player-4', assignmentIds: [4, 2] },
          { userId: 'player-5', assignmentIds: [2, 3] },
        ],
      };

      const result = calculateValidConfigurations(problematicMap, 'player-1');

      expect(result.configurations).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Front');
    });

    it('should return empty configurations when impossible to fill all positions', () => {
      const impossibleMap: MapConfig = {
        ...mockMap,
        players: [
          { userId: 'player-1', assignmentIds: [1, 2] },
          { userId: 'player-2', assignmentIds: [1, 2] },
          { userId: 'player-3', assignmentIds: [3, 4] },
          { userId: 'player-4', assignmentIds: [3, 4] },
          { userId: 'player-5', assignmentIds: [1, 3] },
        ],
      };

      const result = calculateValidConfigurations(impossibleMap, 'player-5');

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Configuration Count', () => {
    it('should find multiple configurations when players have flexibility', () => {
      const flexibleMap: MapConfig = {
        id: 'flexible-map',
        name: 'Flexible Map',
        images: ['/maps/test/Test.png'],
        assignments: [
          { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
          { id: 2, name: 'Position 2', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
        ],
        players: [
          { userId: 'player-1', assignmentIds: [1, 2] },
          { userId: 'player-2', assignmentIds: [1, 2] },
          { userId: 'player-3', assignmentIds: [1, 2] },
        ],
      };

      const result = calculateValidConfigurations(flexibleMap, 'player-3');

      expect(result.configurations.length).toBe(2);
    });

    it('should find exactly one configuration when no flexibility', () => {
      const rigidMap: MapConfig = {
        id: 'rigid-map',
        name: 'Rigid Map',
        images: ['/maps/test/Test.png'],
        assignments: [
          { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
          { id: 2, name: 'Position 2', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
        ],
        players: [
          { userId: 'player-1', assignmentIds: [1] },
          { userId: 'player-2', assignmentIds: [2] },
          { userId: 'player-3', assignmentIds: [1, 2] },
        ],
      };

      const result = calculateValidConfigurations(rigidMap, 'player-3');

      expect(result.configurations.length).toBe(1);
      expect(result.configurations[0]['player-1']).toBe(1);
      expect(result.configurations[0]['player-2']).toBe(2);
    });
  });
});

