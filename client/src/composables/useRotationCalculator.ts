/**
 * Composable for rotation calculator logic
 * Handles configuration calculation, selection, and export
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { getPlayerAssignments, getPlayerMainAssignment } from '@/utils/balance';
import { getPlayerName } from '@/api';
import { getAssignmentColor } from '@/utils/colors';
import type { MapConfig, Player, MatchGamePlan } from '@shared/types';

// Types
export interface ConfigurationResult {
  assignments: Record<number, string>; // assignmentId -> playerId
  mainRoleScore: number; // Number of players on their main role
}

export interface MapResult {
  mapId: string;
  mapName: string;
  planId: string;
  planName: string;
  configurations: ConfigurationResult[];
  errors: string[];
}

export interface ExportableMap {
  mapId: string;
  mapName: string;
  planName: string;
  assignments: {
    assignmentId: number;
    playerId: string;
    assignmentName: string;
    playerName: string;
    assignmentColor: string;
    isMainRole: boolean;
  }[];
}


export interface UseRotationCalculatorOptions {
  maps: Ref<MapConfig[]>;
  players: Ref<Player[]>;
  initialGamePlan?: Ref<MatchGamePlan | null>;
}

export interface UseRotationCalculatorReturn {
  // State
  selectedAbsentPlayer: Ref<string | null>;
  selectedMaps: Ref<string[]>;
  selectedPlans: Ref<Record<string, string>>; // mapId -> planId
  loadedPlans: Ref<Record<string, MapConfig>>; // planId -> loaded plan data
  results: Ref<MapResult[] | null>;
  hasCalculated: Ref<boolean>;
  selectedConfigurations: Ref<Record<string, number>>;
  isLoading: Ref<boolean>;

  // Computed
  canCalculate: ComputedRef<boolean>;
  exportableMaps: ComputedRef<ExportableMap[]>;
  presentPlayers: ComputedRef<Player[]>;
  previewGamePlan: ComputedRef<MatchGamePlan | null>;

  // Methods
  selectAllMaps: () => void;
  deselectAllMaps: () => void;
  toggleMap: (mapId: string) => void;
  selectPlan: (mapId: string, planId: string) => void;
  calculateConfigurations: () => void;
  selectConfiguration: (mapId: string, configIndex: number) => void;
  isConfigSelected: (mapId: string, configIndex: number) => boolean;
  isMainRoleForPlayer: (mapId: string, playerId: string, assignmentId: number) => boolean;
  buildMatchGamePlan: () => MatchGamePlan | null;
}

export function useRotationCalculator(
  options: UseRotationCalculatorOptions
): UseRotationCalculatorReturn {
  const { maps, players, initialGamePlan } = options;

  // State
  const selectedAbsentPlayer = ref<string | null>(null);
  const selectedMaps = ref<string[]>(maps.value.map(m => m.id));
  const selectedPlans = ref<Record<string, string>>({}); // mapId -> planId
  const results = ref<MapResult[] | null>(null);
  const hasCalculated = ref(false);
  const selectedConfigurations = ref<Record<string, number>>({});
  const isLoading = ref(false);
  const isInitialized = ref(false);

  // Initialize from existing game plan if provided
  function initializeFromGamePlan(gamePlan: MatchGamePlan) {
    // Set absent player
    selectedAbsentPlayer.value = gamePlan.absentPlayerId;

    // Set selected maps from the game plan
    const planMapIds = gamePlan.maps.map(m => m.mapId);
    selectedMaps.value = planMapIds;

    // Set selected plans for each map (if planName matches)
    const newSelectedPlans: Record<string, string> = {};
    for (const mapPlan of gamePlan.maps) {
      const map = maps.value.find(m => m.id === mapPlan.mapId);
      if (map?.gamePlans) {
        // Find the plan that matches by name
        const matchingPlan = map.gamePlans.find(p => p.name === mapPlan.planName);
        if (matchingPlan) {
          newSelectedPlans[mapPlan.mapId] = matchingPlan.id;
        } else if (map.gamePlans[0]) {
          newSelectedPlans[mapPlan.mapId] = map.gamePlans[0].id;
        }
      }
    }
    selectedPlans.value = newSelectedPlans;
  }

  // Initialize: set default plans (no API calls needed - data is in maps)
  function initialize() {
    // If we have an initial game plan, initialize from it
    if (initialGamePlan?.value) {
      initializeFromGamePlan(initialGamePlan.value);
      isInitialized.value = true;
      // Trigger calculation with the loaded plan
      calculateConfigurations();
      // Match existing configurations from the game plan
      matchConfigurationsFromGamePlan(initialGamePlan.value);
    } else {
      // Set default plans for all maps
      const defaultPlans: Record<string, string> = {};
      for (const map of maps.value) {
        if (map.gamePlans && map.gamePlans.length > 0 && map.gamePlans[0]) {
          defaultPlans[map.id] = map.gamePlans[0].id;
        }
      }
      selectedPlans.value = defaultPlans;
      isInitialized.value = true;
    }
  }

  // Match configurations from an existing game plan
  function matchConfigurationsFromGamePlan(gamePlan: MatchGamePlan) {
    if (!results.value) return;

    const newConfigs: Record<string, number> = {};

    for (const mapPlan of gamePlan.maps) {
      const mapResult = results.value.find(r => r.mapId === mapPlan.mapId);
      if (!mapResult || mapResult.configurations.length === 0) continue;

      // Build assignment map from the game plan: assignmentId -> playerId
      const targetAssignments: Record<number, string> = {};
      for (const assign of mapPlan.assignments) {
        targetAssignments[assign.assignmentId] = assign.visiblePlayerId;
      }

      // Find the configuration that matches these assignments
      const matchingIndex = mapResult.configurations.findIndex(config => {
        // Check if all assignments match
        for (const [assignmentIdStr, playerId] of Object.entries(config.assignments)) {
          const assignmentId = Number(assignmentIdStr);
          if (targetAssignments[assignmentId] !== playerId) {
            return false;
          }
        }
        return true;
      });

      if (matchingIndex >= 0) {
        newConfigs[mapPlan.mapId] = matchingIndex;
      } else {
        // Fallback to first if no match found
        newConfigs[mapPlan.mapId] = 0;
      }
    }

    selectedConfigurations.value = newConfigs;
  }

  // Get map config for calculation (from gamePlans data in maps)
  function getMapConfigForCalculation(mapId: string): MapConfig | null {
    const map = maps.value.find(m => m.id === mapId);
    if (!map) return null;

    const planId = selectedPlans.value[mapId];
    if (planId && map.gamePlans) {
      const plan = map.gamePlans.find(p => p.id === planId);
      if (plan) {
        // Return a MapConfig with the plan's data
        return {
          id: map.id,
          name: map.name,
          images: map.images,
          assignments: plan.assignments,
          players: plan.players,
          gamePlans: map.gamePlans,
          notes: plan.notes,
        };
      }
    }

    // Fallback to first plan or base map data
    return map;
  }

  // Expose loadedPlans for compatibility (computed from maps.gamePlans)
  const loadedPlans = computed<Record<string, MapConfig>>(() => {
    const result: Record<string, MapConfig> = {};
    for (const map of maps.value) {
      if (map.gamePlans) {
        for (const plan of map.gamePlans) {
          result[plan.id] = {
            id: map.id,
            name: map.name,
            images: map.images,
            assignments: plan.assignments,
            players: plan.players,
            gamePlans: map.gamePlans,
            notes: plan.notes,
          };
        }
      }
    }
    return result;
  });


  // Map selection methods
  function selectAllMaps() {
    selectedMaps.value = maps.value.map(m => m.id);
  }

  function deselectAllMaps() {
    selectedMaps.value = [];
  }

  function toggleMap(mapId: string) {
    if (selectedMaps.value.includes(mapId)) {
      selectedMaps.value = selectedMaps.value.filter(id => id !== mapId);
    } else {
      selectedMaps.value.push(mapId);
    }
  }

  function selectPlan(mapId: string, planId: string) {
    selectedPlans.value = { ...selectedPlans.value, [mapId]: planId };
    // Recalculate this map with the new plan
    if (selectedAbsentPlayer.value && results.value) {
      const newResult = calculateMapConfigurations(mapId);
      if (newResult) {
        const existingIndex = results.value.findIndex(r => r.mapId === mapId);
        if (existingIndex >= 0) {
          results.value[existingIndex] = newResult;
        }
        // Auto-select first configuration for the new plan
        if (newResult.configurations.length > 0) {
          selectedConfigurations.value = {
            ...selectedConfigurations.value,
            [mapId]: 0
          };
        }
      }
    }
  }

  // Calculate configurations for a single map - returns result without modifying state
  function calculateMapConfigurations(mapId: string): MapResult | null {
    const baseMap = maps.value.find(m => m.id === mapId);
    if (!baseMap || !selectedAbsentPlayer.value) return null;

    // Get effective map config (from loaded plan or fallback)
    const effectiveMap = getMapConfigForCalculation(mapId);
    if (!effectiveMap) return null;

    const presentPlayerIds = players.value
      .filter(p => p.id !== selectedAbsentPlayer.value)
      .map(p => p.id);

    // Get selected plan for this map
    const planId = selectedPlans.value[mapId] || '';
    const plan = baseMap.gamePlans?.find(p => p.id === planId);
    const planName = plan?.name || 'Plan par défaut';

    const mapResult: MapResult = {
      mapId: baseMap.id,
      mapName: baseMap.name,
      planId,
      planName,
      configurations: [],
      errors: []
    };

    // Get assignments from the effective map (loaded plan)
    const assignmentIds = effectiveMap.assignments.map(p => p.id);

    // For each present player, which assignments can they take? (from effective map)
    const playerToAssignments: Record<string, number[]> = {};
    for (const playerId of presentPlayerIds) {
      playerToAssignments[playerId] = getPlayerAssignments(effectiveMap, playerId)
        .filter(p => assignmentIds.includes(p));
    }

    // Check basic errors
    for (const assignmentId of assignmentIds) {
      const playersForAssignment = presentPlayerIds.filter(j =>
        playerToAssignments[j]?.includes(assignmentId)
      );
      if (playersForAssignment.length === 0) {
        const assignment = effectiveMap.assignments.find(p => p.id === assignmentId);
        mapResult.errors.push(
          `${assignment?.name || assignmentId} ne peut être occupé par aucun joueur présent`
        );
      }
    }

    if (mapResult.errors.length === 0) {
      // Find all valid configurations
      const configurations = findAllConfigurations(
        assignmentIds,
        presentPlayerIds,
        playerToAssignments,
        effectiveMap
      );

      if (configurations.length === 0) {
        mapResult.errors.push("Aucune configuration valide trouvée");
      } else {
        // Sort configurations by mainRoleScore (descending)
        configurations.sort((a, b) => b.mainRoleScore - a.mainRoleScore);
        mapResult.configurations = configurations;
      }
    }

    return mapResult;
  }

  // Backtracking algorithm to find all valid configurations
  function findAllConfigurations(
    assignmentIds: number[],
    playerIds: string[],
    playerToAssignments: Record<string, number[]>,
    map: MapConfig
  ): ConfigurationResult[] {
    const configResults: ConfigurationResult[] = [];
    const assignment: Record<number, string> = {};
    const usedPlayers = new Set<string>();

    function backtrack(assignmentIndex: number) {
      if (assignmentIndex === assignmentIds.length) {
        // Complete configuration found - calculate mainRoleScore
        let mainRoleScore = 0;
        for (const [assignmentIdStr, playerId] of Object.entries(assignment)) {
          const assignmentId = Number(assignmentIdStr);
          const playerMainRole = getPlayerMainAssignment(map, playerId);
          if (playerMainRole === assignmentId) {
            mainRoleScore++;
          }
        }
        configResults.push({ assignments: { ...assignment }, mainRoleScore });
        return;
      }

      const assignmentId = assignmentIds[assignmentIndex];
      if (!assignmentId) return;

      for (const playerId of playerIds) {
        if (usedPlayers.has(playerId)) continue;
        const playerAssignments = playerToAssignments[playerId];
        if (!playerAssignments || !playerAssignments.includes(assignmentId)) continue;

        // Assign this player to this assignment
        assignment[assignmentId] = playerId;
        usedPlayers.add(playerId);

        backtrack(assignmentIndex + 1);

        // Backtrack
        delete assignment[assignmentId];
        usedPlayers.delete(playerId);
      }
    }

    backtrack(0);
    return configResults;
  }

  // Main calculation function - calculates all selected maps
  function calculateConfigurations() {
    if (!selectedAbsentPlayer.value) return;

    hasCalculated.value = true;

    // Keep track of which maps already had configurations selected
    const previousSelections = { ...selectedConfigurations.value };

    // Get selected maps sorted alphabetically
    const sortedMapIds = [...selectedMaps.value].sort((a, b) => {
      const mapA = maps.value.find(m => m.id === a);
      const mapB = maps.value.find(m => m.id === b);
      return (mapA?.name || '').localeCompare(mapB?.name || '');
    });

    // Calculate configurations for each selected map
    const newResults: MapResult[] = [];
    const newConfigs: Record<string, number> = {};

    for (const mapId of sortedMapIds) {
      const result = calculateMapConfigurations(mapId);
      if (result) {
        newResults.push(result);

        // Preserve previous selection if still valid, otherwise auto-select first
        if (previousSelections[mapId] !== undefined &&
            previousSelections[mapId] < result.configurations.length) {
          newConfigs[mapId] = previousSelections[mapId];
        } else if (result.configurations.length > 0) {
          newConfigs[mapId] = 0; // Auto-select first (best score)
        }
      }
    }

    results.value = newResults;
    selectedConfigurations.value = newConfigs;
  }

  // Watch for changes that should trigger recalculation
  watch(
    [selectedAbsentPlayer, selectedMaps],
    () => {
      if (!isInitialized.value) return;
      if (selectedAbsentPlayer.value && selectedMaps.value.length > 0) {
        calculateConfigurations();
      } else {
        results.value = null;
        hasCalculated.value = false;
      }
    },
    { deep: true }
  );

  // Configuration selection
  function selectConfiguration(mapId: string, configIndex: number) {
    selectedConfigurations.value[mapId] = configIndex;
  }

  function isConfigSelected(mapId: string, configIndex: number): boolean {
    return selectedConfigurations.value[mapId] === configIndex;
  }

  // Check if an assignment is the main role for a player
  function isMainRoleForPlayer(
    mapId: string,
    playerId: string,
    assignmentId: number
  ): boolean {
    const effectiveMap = getMapConfigForCalculation(mapId);
    if (!effectiveMap) return false;
    return getPlayerMainAssignment(effectiveMap, playerId) === assignmentId;
  }

  // Computed properties
  const canCalculate = computed(() => {
    return !!selectedAbsentPlayer.value && selectedMaps.value.length > 0;
  });

  const presentPlayers = computed(() => {
    if (!selectedAbsentPlayer.value) return [];
    return players.value.filter(p => p.id !== selectedAbsentPlayer.value);
  });

  const exportableMaps = computed<ExportableMap[]>(() => {
    if (!results.value) return [];
    return results.value
      .filter(r => r.errors.length === 0 && selectedConfigurations.value[r.mapId] !== undefined)
      .map(r => {
        const configIndex = selectedConfigurations.value[r.mapId];
        const config = configIndex !== undefined ? r.configurations[configIndex] : undefined;
        // Get effective map once for this result
        const effectiveMap = getMapConfigForCalculation(r.mapId);
        return {
          mapId: r.mapId,
          mapName: r.mapName,
          planName: r.planName,
          assignments: config
            ? Object.entries(config.assignments).map(([assignmentIdStr, playerId]) => {
                const assignmentId = Number(assignmentIdStr);
                // Get assignment name from the loaded plan, not the base map
                const assignment = effectiveMap?.assignments.find(a => a.id === assignmentId);
                const assignmentName = assignment?.name || `Assignment #${assignmentId}`;
                // Get main role directly from effectiveMap to avoid extra function call
                const playerAssignment = effectiveMap?.players.find(p => p.userId === playerId);
                const isMainRole = playerAssignment?.mainAssignmentId === assignmentId;
                return {
                  assignmentId,
                  playerId,
                  assignmentName,
                  playerName: getPlayerName(playerId),
                  assignmentColor: getAssignmentColor(assignmentId),
                  isMainRole
                };
              })
            : []
        };
      })
      .filter(m => m.assignments.length > 0);
  });


  const previewGamePlan = computed<MatchGamePlan | null>(() => {
    if (!selectedAbsentPlayer.value) return null;
    return {
      absentPlayerId: selectedAbsentPlayer.value,
      absentPlayerName: getPlayerName(selectedAbsentPlayer.value),
      maps: exportableMaps.value.map(mapData => ({
        mapId: mapData.mapId,
        mapName: mapData.mapName,
        planName: mapData.planName,
        assignments: mapData.assignments.map(a => ({
          visiblePlayerId: a.playerId,
          visiblePlayerName: a.playerName,
          assignmentId: a.assignmentId,
          assignmentName: a.assignmentName,
          assignmentColor: a.assignmentColor,
          isMainRole: a.isMainRole,
        }))
      }))
    };
  });


  function buildMatchGamePlan(): MatchGamePlan | null {
    if (!selectedAbsentPlayer.value || !exportableMaps.value.length) return null;

    const absentPlayer = players.value.find(p => p.id === selectedAbsentPlayer.value);
    if (!absentPlayer) return null;

    return {
      absentPlayerId: absentPlayer.id,
      absentPlayerName: absentPlayer.name,
      maps: exportableMaps.value.map(mapData => ({
        mapId: mapData.mapId,
        mapName: mapData.mapName,
        planName: mapData.planName,
        assignments: mapData.assignments.map(a => ({
          visiblePlayerId: a.playerId,
          visiblePlayerName: a.playerName,
          assignmentId: a.assignmentId,
          assignmentName: a.assignmentName,
          assignmentColor: a.assignmentColor,
          isMainRole: a.isMainRole,
        })),
      })),
    };
  }

  // Initialize (must be after all functions are defined)
  initialize();

  return {
    // State
    selectedAbsentPlayer,
    selectedMaps,
    selectedPlans,
    loadedPlans,
    results,
    hasCalculated,
    selectedConfigurations,
    isLoading,

    // Computed
    canCalculate,
    exportableMaps,
    presentPlayers,
    previewGamePlan,

    // Methods
    selectAllMaps,
    deselectAllMaps,
    toggleMap,
    selectPlan,
    calculateConfigurations,
    selectConfiguration,
    isConfigSelected,
    isMainRoleForPlayer,
    buildMatchGamePlan,
  };
}
