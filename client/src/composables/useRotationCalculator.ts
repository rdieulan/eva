/**
 * Composable for rotation calculator logic
 * Handles configuration calculation, selection, and export
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { getPlayerAssignments, getPlayerMainAssignment, getAssignmentName } from '@/utils/balance';
import { getPlayerName } from '@/api';
import { getAssignmentColor } from '@/utils/colors';
import type { MapConfig, Player, MatchGamePlan, GamePhase } from '@shared/types';

// Types
export interface ConfigurationResult {
  assignments: Record<number, string>; // assignmentId -> playerId
  mainRoleScore: number; // Number of players on their main role
}

export interface MapResult {
  mapId: string;
  mapName: string;
  configurations: ConfigurationResult[];
  errors: string[];
}

export interface ExportableMap {
  mapId: string;
  mapName: string;
  assignments: {
    assignmentId: number;
    playerId: string;
    assignmentName: string;
    playerName: string;
    assignmentColor: string;
    isMainRole: boolean;
  }[];
}

export interface TableDataRow {
  mapId: string;
  mapName: string;
  players: Record<string, { assignmentName: string; assignmentColor: string } | null>;
}

export interface UseRotationCalculatorOptions {
  maps: Ref<MapConfig[]>;
  players: Ref<Player[]>;
}

export interface UseRotationCalculatorReturn {
  // State
  selectedAbsentPlayer: Ref<string | null>;
  selectedMaps: Ref<string[]>;
  results: Ref<MapResult[] | null>;
  hasCalculated: Ref<boolean>;
  currentPhase: Ref<GamePhase>;
  selectedConfigurations: Ref<Record<string, number>>;

  // Computed
  canCalculate: ComputedRef<boolean>;
  canExport: ComputedRef<boolean>;
  exportableMaps: ComputedRef<ExportableMap[]>;
  presentPlayers: ComputedRef<Player[]>;
  tableData: ComputedRef<TableDataRow[]>;
  exportHeaders: ComputedRef<{ id: string; name: string }[]>;
  previewGamePlan: ComputedRef<MatchGamePlan | null>;

  // Methods
  selectAllMaps: () => void;
  deselectAllMaps: () => void;
  toggleMap: (mapId: string) => void;
  calculateConfigurations: () => void;
  selectConfiguration: (mapId: string, configIndex: number) => void;
  isConfigSelected: (mapId: string, configIndex: number) => boolean;
  isMainRoleForPlayer: (mapId: string, playerId: string, assignmentId: number) => boolean;
  generateExportText: () => string;
  exportToClipboard: () => Promise<void>;
  exportToPng: (element: HTMLElement | null) => Promise<void>;
  buildMatchGamePlan: () => MatchGamePlan | null;
}

export function useRotationCalculator(
  options: UseRotationCalculatorOptions
): UseRotationCalculatorReturn {
  const { maps, players } = options;

  // State
  const selectedAbsentPlayer = ref<string | null>(null);
  const selectedMaps = ref<string[]>(maps.value.map(m => m.id));
  const results = ref<MapResult[] | null>(null);
  const hasCalculated = ref(false);
  const currentPhase = ref<GamePhase>('START');
  const selectedConfigurations = ref<Record<string, number>>({});

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

  // Main calculation function
  function calculateConfigurations() {
    if (!selectedAbsentPlayer.value) return;

    hasCalculated.value = true;
    results.value = [];
    selectedConfigurations.value = {}; // Reset selections

    const presentPlayerIds = players.value
      .filter(p => p.id !== selectedAbsentPlayer.value)
      .map(p => p.id);

    for (const mapId of selectedMaps.value) {
      const map = maps.value.find(m => m.id === mapId);
      if (!map) continue;

      const mapResult: MapResult = {
        mapId: map.id,
        mapName: map.name,
        configurations: [],
        errors: []
      };

      // Get map assignments
      const assignmentIds = map.assignments.map(p => p.id);

      // For each present player, which assignments can they take?
      const playerToAssignments: Record<string, number[]> = {};
      for (const playerId of presentPlayerIds) {
        playerToAssignments[playerId] = getPlayerAssignments(map, playerId)
          .filter(p => assignmentIds.includes(p));
      }

      // Check basic errors
      for (const assignmentId of assignmentIds) {
        const playersForAssignment = presentPlayerIds.filter(j =>
          playerToAssignments[j]?.includes(assignmentId)
        );
        if (playersForAssignment.length === 0) {
          const assignment = map.assignments.find(p => p.id === assignmentId);
          mapResult.errors.push(
            `${assignment?.name || assignmentId} ne peut être occupé par aucun joueur présent`
          );
        }
      }

      if (mapResult.errors.length > 0) {
        results.value.push(mapResult);
        continue;
      }

      // Find all valid configurations
      const configurations = findAllConfigurations(
        assignmentIds,
        presentPlayerIds,
        playerToAssignments,
        map
      );

      if (configurations.length === 0) {
        mapResult.errors.push("Aucune configuration valide trouvée");
      } else {
        // Sort configurations by mainRoleScore (descending)
        configurations.sort((a, b) => b.mainRoleScore - a.mainRoleScore);
        mapResult.configurations = configurations;
        // Automatically select first configuration (best score)
        selectedConfigurations.value[mapResult.mapId] = 0;
      }

      results.value.push(mapResult);
    }
  }

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
    const map = maps.value.find(m => m.id === mapId);
    if (!map) return false;
    return getPlayerMainAssignment(map, playerId) === assignmentId;
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
        return {
          mapId: r.mapId,
          mapName: r.mapName,
          assignments: config
            ? Object.entries(config.assignments).map(([assignmentIdStr, playerId]) => {
                const assignmentId = Number(assignmentIdStr);
                return {
                  assignmentId,
                  playerId,
                  assignmentName: getAssignmentName(maps.value, r.mapId, assignmentId),
                  playerName: getPlayerName(playerId),
                  assignmentColor: getAssignmentColor(assignmentId),
                  isMainRole: isMainRoleForPlayer(r.mapId, playerId, assignmentId)
                };
              })
            : []
        };
      })
      .filter(m => m.assignments.length > 0);
  });

  const canExport = computed(() => {
    if (!results.value) return false;
    const validMaps = results.value.filter(
      r => r.errors.length === 0 && r.configurations.length > 0
    );
    if (validMaps.length === 0) return false;
    return validMaps.every(r => selectedConfigurations.value[r.mapId] !== undefined);
  });

  const tableData = computed<TableDataRow[]>(() => {
    if (!exportableMaps.value.length) return [];

    return exportableMaps.value.map(mapData => {
      const row: Record<string, { assignmentName: string; assignmentColor: string } | null> = {};

      for (const player of presentPlayers.value) {
        const assign = mapData.assignments.find(a => a.playerId === player.id);
        row[player.id] = assign
          ? { assignmentName: assign.assignmentName, assignmentColor: assign.assignmentColor }
          : null;
      }

      return {
        mapId: mapData.mapId,
        mapName: mapData.mapName,
        players: row
      };
    });
  });

  const exportHeaders = computed(() => {
    return presentPlayers.value.map(p => ({ id: p.id, name: p.name }));
  });

  const previewGamePlan = computed<MatchGamePlan | null>(() => {
    if (!selectedAbsentPlayer.value) return null;
    return {
      absentPlayerId: selectedAbsentPlayer.value,
      absentPlayerName: getPlayerName(selectedAbsentPlayer.value),
      maps: exportableMaps.value.map(mapData => ({
        mapId: mapData.mapId,
        mapName: mapData.mapName,
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

  // Export functions
  function generateExportText(): string {
    if (!results.value || !selectedAbsentPlayer.value || !tableData.value.length) return '';

    const absentName = getPlayerName(selectedAbsentPlayer.value);
    const playerList = presentPlayers.value;

    // Calculate column widths
    const mapColWidth = Math.max(10, ...tableData.value.map(r => r.mapName.length)) + 2;
    const playerColWidth = Math.max(8, ...playerList.map(j => j.name.length)) + 2;

    let text = `\n  PLAN DE JEU - ${absentName} absent(e)\n`;
    text += `${'═'.repeat(mapColWidth + playerColWidth * playerList.length + playerList.length + 1)}\n\n`;

    // Header
    text += `  ${'Map'.padEnd(mapColWidth)}`;
    for (const player of playerList) {
      text += `│ ${player.name.padEnd(playerColWidth - 2)} `;
    }
    text += `\n`;

    // Separator line
    text += `  ${'─'.repeat(mapColWidth)}`;
    for (let i = 0; i < playerList.length; i++) {
      text += `┼${'─'.repeat(playerColWidth)}`;
    }
    text += `\n`;

    // Data
    for (const row of tableData.value) {
      text += `  ${row.mapName.padEnd(mapColWidth)}`;
      for (const player of playerList) {
        const cell = row.players[player.id];
        const cellText = cell ? cell.assignmentName : '-';
        text += `│ ${cellText.padEnd(playerColWidth - 2)} `;
      }
      text += `\n`;
    }

    text += `\n`;
    return text;
  }

  async function exportToClipboard(): Promise<void> {
    const text = generateExportText();
    try {
      await navigator.clipboard.writeText(text);
      alert('Plan de jeu copié dans le presse-papier !');
    } catch (err) {
      console.error('Copy error:', err);
      alert('Erreur lors de la copie');
    }
  }

  async function exportToPng(element: HTMLElement | null): Promise<void> {
    if (!element) return;

    try {
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(element, {
        backgroundColor: '#1a1a2e',
        scale: 2,
      });

      const link = document.createElement('a');
      link.download = `plan-de-jeu-${selectedAbsentPlayer.value}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export error:', err);
      alert("Erreur lors de l'export PNG. Assurez-vous que html2canvas est installé.");
    }
  }

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

  return {
    // State
    selectedAbsentPlayer,
    selectedMaps,
    results,
    hasCalculated,
    currentPhase,
    selectedConfigurations,

    // Computed
    canCalculate,
    canExport,
    exportableMaps,
    presentPlayers,
    tableData,
    exportHeaders,
    previewGamePlan,

    // Methods
    selectAllMaps,
    deselectAllMaps,
    toggleMap,
    calculateConfigurations,
    selectConfiguration,
    isConfigSelected,
    isMainRoleForPlayer,
    generateExportText,
    exportToClipboard,
    exportToPng,
    buildMatchGamePlan,
  };
}
