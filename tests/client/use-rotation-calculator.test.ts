/**
 * Tests for useRotationCalculator composable
 * Tests configuration calculation algorithm and export functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useRotationCalculator } from '@/composables/useRotationCalculator';
import type { MapConfig, Player } from '@shared/types';

// Mock dependencies
vi.mock('@/api', () => ({
  getPlayerName: vi.fn((players: Player[], id: string) => {
    const player = players.find(p => p.id === id);
    return player?.name || id;
  }),
}));

vi.mock('@/utils/colors', () => ({
  getAssignmentColor: vi.fn((id: number) => `color-${id}`),
}));

describe('useRotationCalculator', () => {
  const createMockMaps = (): MapConfig[] => [
    {
      id: 'map-1',
      name: 'Test Map 1',
      images: ['/test1.png'],
      assignments: [
        { id: 1, name: 'Role A', x: 25, y: 25 },
        { id: 2, name: 'Role B', x: 75, y: 25 },
        { id: 3, name: 'Role C', x: 25, y: 75 },
        { id: 4, name: 'Role D', x: 75, y: 75 },
      ],
      players: [
        { userId: 'player-1', assignmentIds: [1, 2], mainAssignmentId: 1 },
        { userId: 'player-2', assignmentIds: [2, 3], mainAssignmentId: 2 },
        { userId: 'player-3', assignmentIds: [3, 4], mainAssignmentId: 3 },
        { userId: 'player-4', assignmentIds: [1, 4], mainAssignmentId: 4 },
        { userId: 'player-5', assignmentIds: [1, 2, 3, 4] },
      ],
    },
  ];

  const createMockPlayers = (): Player[] => [
    { id: 'player-1', name: 'Alice' },
    { id: 'player-2', name: 'Bob' },
    { id: 'player-3', name: 'Charlie' },
    { id: 'player-4', name: 'David' },
    { id: 'player-5', name: 'Eve' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with all maps selected', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { selectedMaps } = useRotationCalculator({ maps, players });

      expect(selectedMaps.value).toEqual(['map-1']);
    });

    it('should initialize with no absent player selected', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { selectedAbsentPlayer } = useRotationCalculator({ maps, players });

      expect(selectedAbsentPlayer.value).toBeNull();
    });

    it('should initialize with hasCalculated as false', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { hasCalculated } = useRotationCalculator({ maps, players });

      expect(hasCalculated.value).toBe(false);
    });
  });

  describe('Map Selection', () => {
    it('should toggle map selection', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { selectedMaps, toggleMap } = useRotationCalculator({ maps, players });

      expect(selectedMaps.value).toContain('map-1');
      toggleMap('map-1');
      expect(selectedMaps.value).not.toContain('map-1');
      toggleMap('map-1');
      expect(selectedMaps.value).toContain('map-1');
    });

    it('should deselect all maps', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { selectedMaps, deselectAllMaps } = useRotationCalculator({ maps, players });

      deselectAllMaps();
      expect(selectedMaps.value).toEqual([]);
    });

    it('should select all maps', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { selectedMaps, deselectAllMaps, selectAllMaps } = useRotationCalculator({ maps, players });

      deselectAllMaps();
      selectAllMaps();
      expect(selectedMaps.value).toEqual(['map-1']);
    });
  });

  describe('canCalculate Computed', () => {
    it('should return false when no absent player is selected', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { canCalculate } = useRotationCalculator({ maps, players });

      expect(canCalculate.value).toBe(false);
    });

    it('should return true when absent player is selected and maps are selected', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { canCalculate, selectedAbsentPlayer } = useRotationCalculator({ maps, players });

      selectedAbsentPlayer.value = 'player-5';
      expect(canCalculate.value).toBe(true);
    });

    it('should return false when no maps are selected', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { canCalculate, selectedAbsentPlayer, deselectAllMaps } = useRotationCalculator({ maps, players });

      selectedAbsentPlayer.value = 'player-5';
      deselectAllMaps();
      expect(canCalculate.value).toBe(false);
    });
  });

  describe('calculateConfigurations', () => {
    it('should find valid configurations when absent player is selected', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { calculateConfigurations, selectedAbsentPlayer, results, hasCalculated } = useRotationCalculator({ maps, players });

      selectedAbsentPlayer.value = 'player-5';
      calculateConfigurations();

      expect(hasCalculated.value).toBe(true);
      expect(results.value).not.toBeNull();
      expect(results.value).toHaveLength(1); // One map
    });

    it('should not calculate when no absent player selected', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { calculateConfigurations, results, hasCalculated } = useRotationCalculator({ maps, players });

      calculateConfigurations();

      expect(hasCalculated.value).toBe(false);
      expect(results.value).toBeNull();
    });

    it('should find configurations that cover all 4 roles', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { calculateConfigurations, selectedAbsentPlayer, results } = useRotationCalculator({ maps, players });

      selectedAbsentPlayer.value = 'player-5';
      calculateConfigurations();

      const mapResult = results.value?.[0];
      expect(mapResult).toBeDefined();

      if (mapResult && mapResult.configurations.length > 0) {
        const firstConfig = mapResult.configurations[0];
        // Should have 4 assignments
        expect(Object.keys(firstConfig.assignments)).toHaveLength(4);
      }
    });
  });

  describe('Configuration Selection', () => {
    it('should select a configuration for a map', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { selectConfiguration, isConfigSelected, selectedAbsentPlayer, calculateConfigurations } = useRotationCalculator({ maps, players });

      selectedAbsentPlayer.value = 'player-5';
      calculateConfigurations();

      selectConfiguration('map-1', 0);
      expect(isConfigSelected('map-1', 0)).toBe(true);
      expect(isConfigSelected('map-1', 1)).toBe(false);
    });
  });

  describe('Present Players', () => {
    it('should return all players except the absent one', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { presentPlayers, selectedAbsentPlayer } = useRotationCalculator({ maps, players });

      selectedAbsentPlayer.value = 'player-5';
      expect(presentPlayers.value).toHaveLength(4);
      expect(presentPlayers.value.map(p => p.id)).not.toContain('player-5');
    });

    it('should return empty array when no absent player selected', () => {
      const maps = ref(createMockMaps());
      const players = ref(createMockPlayers());
      const { presentPlayers, selectedAbsentPlayer } = useRotationCalculator({ maps, players });

      // When no absent player is selected, presentPlayers returns empty
      // This is intentional: you must select who is absent before calculating
      expect(selectedAbsentPlayer.value).toBeNull();
      expect(presentPlayers.value).toHaveLength(0);
    });
  });
});
