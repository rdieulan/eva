<script setup lang="ts">
import { ref, computed } from 'vue';
import { assignmentColors, getPlayerAssignments } from '@/config/config';
import GamePlanTable from '@/components/common/GamePlanTable.vue';
import type { MapConfig, Player, MatchGamePlan } from '@shared/types';

const props = withDefaults(
  defineProps<{
    maps: MapConfig[];
    players: Player[];
    mode?: 'standalone' | 'associate'; // 'associate' mode shows "Associer" button
  }>(),
  {
    mode: 'standalone',
  }
);

const emit = defineEmits<{
  close: [];
  associate: [gamePlan: MatchGamePlan];
}>();

const selectedAbsentPlayer = ref<string | null>(null);
const selectedMaps = ref<string[]>(props.maps.map(m => m.id));
const results = ref<MapResult[] | null>(null);
const hasCalculated = ref(false);

// Selected configurations per map (mapId -> configuration index)
const selectedConfigurations = ref<Record<string, number>>({});

// Ref for exportable content
const exportContentRef = ref<HTMLDivElement | null>(null);

interface ConfigurationResult {
  assignments: Record<number, string>; // assignmentId -> playerId
}

interface MapResult {
  mapId: string;
  mapName: string;
  configurations: ConfigurationResult[];
  errors: string[];
}

// Select/deselect all maps
function selectAllMaps() {
  selectedMaps.value = props.maps.map(m => m.id);
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

// Algorithm to calculate valid configurations
function calculateConfigurations() {
  if (!selectedAbsentPlayer.value) return;

  hasCalculated.value = true;
  results.value = [];
  selectedConfigurations.value = {}; // Reset selections

  const presentPlayers = props.players
    .filter(p => p.id !== selectedAbsentPlayer.value)
    .map(p => p.id);

  for (const mapId of selectedMaps.value) {
    const map = props.maps.find(m => m.id === mapId);
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
    for (const playerId of presentPlayers) {
      playerToAssignments[playerId] = getPlayerAssignments(map, playerId).filter(p => assignmentIds.includes(p));
    }

    // Check basic errors
    for (const assignmentId of assignmentIds) {
      const playersForAssignment = presentPlayers.filter(j =>
        playerToAssignments[j]?.includes(assignmentId)
      );
      if (playersForAssignment.length === 0) {
        const assignment = map.assignments.find(p => p.id === assignmentId);
        mapResult.errors.push(`${assignment?.name || assignmentId} ne peut être occupé par aucun joueur présent`);
      }
    }

    if (mapResult.errors.length > 0) {
      results.value.push(mapResult);
      continue;
    }

    // Find all valid configurations (backtracking)
    const configurations = findAllConfigurations(assignmentIds, presentPlayers, playerToAssignments);

    if (configurations.length === 0) {
      mapResult.errors.push("Aucune configuration valide trouvée");
    } else {
      mapResult.configurations = configurations;
      // Automatically select first configuration
      selectedConfigurations.value[mapResult.mapId] = 0;
    }

    results.value.push(mapResult);
  }
}

// Backtracking algorithm to find all configurations
function findAllConfigurations(
  assignmentIds: number[],
  playerIds: string[],
  playerToAssignments: Record<string, number[]>
): ConfigurationResult[] {
  const configResults: ConfigurationResult[] = [];
  const assignment: Record<number, string> = {};
  const usedPlayers = new Set<string>();

  function backtrack(assignmentIndex: number) {
    if (assignmentIndex === assignmentIds.length) {
      // Complete configuration found
      configResults.push({ assignments: { ...assignment } });
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

// Display helpers
function getPlayerName(playerId: string): string {
  return props.players.find(p => p.id === playerId)?.name || playerId;
}

function getAssignmentName(mapId: string, assignmentId: number): string {
  const map = props.maps.find(m => m.id === mapId);
  return map?.assignments.find(p => p.id === assignmentId)?.name || `Assignment #${assignmentId}`;
}

function getAssignmentColor(assignmentId: number): string {
  return assignmentColors[assignmentId] || '#888';
}

const canCalculate = computed(() => {
  return selectedAbsentPlayer.value && selectedMaps.value.length > 0;
});

// Select a configuration for a map
function selectConfiguration(mapId: string, configIndex: number) {
  selectedConfigurations.value[mapId] = configIndex;
}

// Check if a configuration is selected
function isConfigSelected(mapId: string, configIndex: number): boolean {
  return selectedConfigurations.value[mapId] === configIndex;
}

// Check if all valid maps have a selected configuration
const canExport = computed(() => {
  if (!results.value) return false;
  const validMaps = results.value.filter(r => r.errors.length === 0 && r.configurations.length > 0);
  if (validMaps.length === 0) return false;
  return validMaps.every(r => selectedConfigurations.value[r.mapId] !== undefined);
});

// Exportable maps with their selected configuration
const exportableMaps = computed(() => {
  if (!results.value) return [];
  return results.value
    .filter(r => r.errors.length === 0 && selectedConfigurations.value[r.mapId] !== undefined)
    .map(r => {
      const configIndex = selectedConfigurations.value[r.mapId];
      const config = configIndex !== undefined ? r.configurations[configIndex] : undefined;
      return {
        mapId: r.mapId,
        mapName: r.mapName,
        assignments: config ? Object.entries(config.assignments).map(([assignmentIdStr, playerId]) => {
          const assignmentId = Number(assignmentIdStr);
          return {
            assignmentId,
            playerId,
            assignmentName: getAssignmentName(r.mapId, assignmentId),
            playerName: getPlayerName(playerId),
            assignmentColor: getAssignmentColor(assignmentId)
          };
        }) : []
      };
    })
    .filter(m => m.assignments.length > 0);
});

// Present players (all except absent)
const presentPlayers = computed(() => {
  if (!selectedAbsentPlayer.value) return [];
  return props.players.filter(p => p.id !== selectedAbsentPlayer.value);
});

// Table data for export (map -> player -> assignment)
const tableData = computed(() => {
  if (!exportableMaps.value.length) return [];

  return exportableMaps.value.map(mapData => {
    const row: Record<string, { assignmentName: string; assignmentColor: string } | null> = {};

    // For each present player, find their assignment on this map
    for (const player of presentPlayers.value) {
      const assign = mapData.assignments.find(a => a.playerId === player.id);
      if (assign) {
        row[player.id] = {
          assignmentName: assign.assignmentName,
          assignmentColor: assign.assignmentColor
        };
      } else {
        row[player.id] = null;
      }
    }

    return {
      mapId: mapData.mapId,
      mapName: mapData.mapName,
      players: row
    };
  });
});

// Generate formatted text for export (table format)
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

// Export to clipboard
async function exportToClipboard() {
  const text = generateExportText();
  try {
    await navigator.clipboard.writeText(text);
    alert('Plan de jeu copié dans le presse-papier !');
  } catch (err) {
    console.error('Copy error:', err);
    alert('Erreur lors de la copie');
  }
}

// Export to PNG
async function exportToPng() {
  if (!exportContentRef.value) return;

  try {
    // Dynamic import of html2canvas
    const html2canvas = (await import('html2canvas')).default;

    const canvas = await html2canvas(exportContentRef.value, {
      backgroundColor: '#1a1a2e',
      scale: 2,
    });

    const link = document.createElement('a');
    link.download = `plan-de-jeu-${selectedAbsentPlayer.value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('PNG export error:', err);
    alert('Erreur lors de l\'export PNG. Assurez-vous que html2canvas est installé.');
  }
}

// Build MatchGamePlan object for association with a match
function buildMatchGamePlan(): MatchGamePlan | null {
  if (!selectedAbsentPlayer.value || !exportableMaps.value.length) return null;

  const absentPlayer = props.players.find(p => p.id === selectedAbsentPlayer.value);
  if (!absentPlayer) return null;

  return {
    absentPlayerId: absentPlayer.id,
    absentPlayerName: absentPlayer.name,
    maps: exportableMaps.value.map(mapData => ({
      mapId: mapData.mapId,
      mapName: mapData.mapName,
      assignments: mapData.assignments.map(a => ({
        visibleplayerId: a.playerId,
        visibleplayerName: a.playerName,
        assignmentId: a.assignmentId,
        assignmentName: a.assignmentName,
        assignmentColor: a.assignmentColor,
      })),
    })),
  };
}

// Handle "Associer" button click
function handleAssociate() {
  const gamePlan = buildMatchGamePlan();
  if (gamePlan) {
    emit('associate', gamePlan);
  }
}

const exportHeaders = computed(() => {
  return presentPlayers.value.map(p => ({ id: p.id, name: p.name }));
});

const previewGamePlan = computed(() => {
  // Build a MatchGamePlan-like object from exportableMaps for preview only
  if (!selectedAbsentPlayer.value) return null;
  return {
    absentPlayerId: selectedAbsentPlayer.value,
    absentPlayerName: getPlayerName(selectedAbsentPlayer.value),
    maps: exportableMaps.value.map(mapData => ({
      mapId: mapData.mapId,
      mapName: mapData.mapName,
      assignments: mapData.assignments.map(a => ({
        visibleplayerId: a.playerId,
        visibleplayerName: a.playerName,
        assignmentId: a.assignmentId,
        assignmentName: a.assignmentName,
        assignmentColor: a.assignmentColor,
      }))
    }))
  } as const;
});
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Calculateur de rotation</h2>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Absent player selection -->
        <div class="form-group">
          <label>Joueur(se) absent(e) :</label>
          <div class="joueur-selector">
            <button
              v-for="player in players"
              :key="player.id"
              :class="{ active: selectedAbsentPlayer === player.id }"
              @click="selectedAbsentPlayer = player.id"
            >
              {{ player.name }}
            </button>
          </div>
        </div>

        <!-- Map selection -->
        <div class="form-group">
          <div class="maps-header">
            <label>Maps à analyser :</label>
            <div class="maps-actions">
              <button class="btn-small" @click="selectAllMaps">Tout</button>
              <button class="btn-small" @click="deselectAllMaps">Aucun</button>
            </div>
          </div>
          <div class="maps-selector">
            <label
              v-for="map in maps"
              :key="map.id"
              class="map-checkbox"
              :class="{ checked: selectedMaps.includes(map.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedMaps.includes(map.id)"
                @change="toggleMap(map.id)"
              />
              {{ map.name }}
            </label>
          </div>
        </div>

        <!-- Calculate button -->
        <button
          class="btn-calculate"
          :disabled="!canCalculate"
          @click="calculateConfigurations"
        >
          Calculer
        </button>

        <!-- Results -->
        <div v-if="hasCalculated && results" class="results">
          <div
            v-for="result in results"
            :key="result.mapId"
            class="result-card"
            :class="{ 'has-errors': result.errors.length > 0 }"
          >
            <h3>{{ result.mapName }}</h3>

            <!-- Errors -->
            <div v-if="result.errors.length > 0" class="result-errors">
              <div v-for="(error, i) in result.errors" :key="i" class="error-row">
                <span class="error-icon">⚠</span>
                <span>{{ error }}</span>
              </div>
            </div>

            <!-- Valid configurations -->
            <div v-else class="result-configurations">
              <div class="config-count">
                {{ result.configurations.length }} configuration(s) possible(s)
              </div>

              <div
                v-for="(config, i) in result.configurations.slice(0, 10)"
                :key="i"
                class="configuration"
                :class="{ selected: isConfigSelected(result.mapId, i) }"
                @click="selectConfiguration(result.mapId, i)"
              >
                <span class="config-selector">
                  {{ isConfigSelected(result.mapId, i) ? '●' : '○' }}
                </span>
                <span
                  v-for="(playerId, assignmentId) in config.assignments"
                  :key="assignmentId"
                  class="assignment"
                >
                  <span
                    class="assignment-tag"
                    :style="{
                      borderColor: getAssignmentColor(Number(assignmentId)),
                      color: getAssignmentColor(Number(assignmentId))
                    }"
                  >
                    {{ getAssignmentName(result.mapId, Number(assignmentId)) }}
                  </span>
                  <span class="joueur-name">{{ getPlayerName(playerId) }}</span>
                </span>
              </div>

              <div
                v-if="result.configurations.length > 10"
                class="more-configs"
              >
                ... et {{ result.configurations.length - 10 }} autre(s) configuration(s)
              </div>
            </div>
          </div>
        </div>

<!-- Export Section -->
        <div v-if="hasCalculated && results && canExport" class="export-section">
          <h3>Générer le plan de jeu</h3>

          <!-- Table preview -->
          <div ref="exportContentRef" class="export-preview">
            <div class="export-header">
              <span class="export-title">PLAN DE JEU</span>
              <span class="export-subtitle">{{ getPlayerName(selectedAbsentPlayer!) }} absent(e)</span>
            </div>

            <!-- Map / Players table -->
            <GamePlanTable v-if="previewGamePlan" :headers="exportHeaders" :gamePlan="previewGamePlan" />

          </div>

          <!-- Export buttons -->
          <div class="export-buttons">
            <button class="btn-export btn-clipboard" @click="exportToClipboard">
              📋 Copier (texte)
            </button>
            <button class="btn-export btn-png" @click="exportToPng">
              🖼️ Télécharger (PNG)
            </button>
            <button
              v-if="mode === 'associate'"
              class="btn-export btn-associate"
              @click="handleAssociate"
            >
              ✓ Associer au match
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 80px;
  z-index: 1000;
}

.modal-content {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  width: 90%;
  max-width: 600px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid $color-border;

  h2 {
    margin: 0;
    font-size: 1.2rem;
    color: #fff;
  }
}

.btn-close {
  background: transparent;
  border: none;
  color: $color-text-secondary;
  font-size: 1.2rem;
  cursor: pointer;
  padding: $spacing-xs $spacing-sm;
  transition: color 0.2s;

  &:hover {
    color: #fff;
  }
}

.modal-body {
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;

  @include tablet {
    padding: 1.25rem;
    gap: $spacing-md;
  }

  @include mobile-lg {
    padding: $spacing-md;
    gap: 0.875rem;
  }

  @include mobile {
    padding: 0.75rem;
    gap: 0.75rem;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  label {
    color: #aaa;
    font-size: 0.9rem;
    font-weight: 600;

    @include tablet {
      font-size: 0.9rem;
    }

    @include mobile-lg {
      font-size: 0.85rem;
    }

    @include mobile {
      font-size: 0.8rem;
      margin-bottom: 0.4rem;
    }
  }
}

.joueur-selector {
  display: flex;
  gap: $spacing-sm;
  flex-wrap: wrap;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: 0.3rem;
  }

  button {
    padding: 0.4rem 0.8rem;
    border: 2px solid #666;
    background: transparent;
    color: #ccc;
    border-radius: $radius-sm;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: $color-border-light;
      border-color: $color-text-secondary;
    }

    &.active {
      background: $color-danger;
      border-color: $color-danger;
      color: #fff;
    }

    @include tablet {
      padding: 0.35rem 0.6rem;
      font-size: 0.8rem;
    }

    @include mobile-lg {
      padding: 0.3rem $spacing-sm;
      font-size: 0.75rem;
    }

    @include mobile {
      padding: $spacing-xs 0.4rem;
      font-size: 0.7rem;
    }
  }
}

.maps-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.maps-actions {
  display: flex;
  gap: $spacing-sm;
}

.btn-small {
  padding: 0.2rem $spacing-sm;
  background: $color-bg-tertiary;
  border: 1px solid #444;
  color: #aaa;
  border-radius: 3px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    color: #fff;
  }
}

.maps-selector {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: 0.3rem;
  }
}

.map-checkbox {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  background: $color-bg-tertiary;
  border: 1px solid #444;
  border-radius: $radius-sm;
  color: #aaa;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: $color-border-light;
    border-color: #666;
  }

  &.checked {
    background: rgba($color-success, 0.2);
    border-color: $color-success;
    color: $color-success;
  }

  input {
    display: none;
  }

  @include tablet {
    padding: 0.35rem 0.6rem;
    font-size: 0.75rem;
  }

  @include mobile-lg {
    padding: 0.3rem $spacing-sm;
    font-size: 0.7rem;
  }

  @include mobile {
    padding: $spacing-xs 0.4rem;
    font-size: 0.65rem;
  }
}

.btn-calculate {
  padding: 0.75rem $spacing-lg;
  background: $color-success;
  border: none;
  border-radius: 6px;
  color: $color-bg-secondary;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  align-self: center;

  &:hover:not(:disabled) {
    background: #6ee7a0;
    transform: translateY(-1px);
  }

  &:disabled {
    background: #444;
    color: $color-text-secondary;
    cursor: not-allowed;
  }

  @include tablet {
    padding: 0.625rem 1.25rem;
    font-size: 0.9rem;
  }

  @include mobile-lg {
    padding: $spacing-sm $spacing-md;
    font-size: 0.85rem;
  }

  @include mobile {
    padding: 0.45rem 0.875rem;
    font-size: 0.8rem;
  }
}

.results {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  border-top: 1px solid $color-border;
  padding-top: $spacing-lg;
}

.result-card {
  background: #252540;
  border: 1px solid $color-border;
  border-radius: 6px;
  padding: $spacing-md;

  &.has-errors {
    border-color: rgba($color-danger, 0.5);
  }

  h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: #fff;

    @include mobile-lg {
      font-size: 0.9rem;
    }

    @include mobile {
      font-size: 0.85rem;
    }
  }

  @include tablet {
    padding: 0.875rem;
  }

  @include mobile-lg {
    padding: 0.75rem;
  }

  @include mobile {
    padding: 0.625rem;
  }
}

.result-errors {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.error-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  color: $color-danger;
  font-size: 0.85rem;

  @include mobile {
    font-size: 0.75rem;
  }
}

.error-icon {
  flex-shrink: 0;
}

.result-configurations {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.config-count {
  color: $color-success;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: $spacing-xs;

  @include mobile {
    font-size: 0.75rem;
  }
}

.configuration {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: $spacing-sm;
  background: $color-bg-secondary;
  border-radius: $radius-sm;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  align-items: center;

  &:hover {
    background: #252545;
    border-color: #444;
  }

  &.selected {
    background: rgba($color-success, 0.1);
    border-color: $color-success;

    .config-selector {
      color: $color-success;
    }
  }

  @include mobile-lg {
    flex-wrap: wrap;
    gap: 0.35rem;
  }
}

.config-selector {
  color: #666;
  font-size: 0.9rem;
  margin-right: $spacing-xs;
}

.assignment {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.assignment-tag {
  padding: 0.15rem 0.4rem;
  border: 1px solid;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;

  @include mobile-lg {
    font-size: 0.65rem;
    padding: 0.1rem 0.3rem;
  }
}

.joueur-name {
  color: #fff;
  font-size: 0.85rem;

  @include mobile-lg {
    font-size: 0.7rem;
  }
}

.more-configs {
  color: $color-text-secondary;
  font-size: 0.8rem;
  font-style: italic;
  padding-top: $spacing-xs;
}

.export-section {
  border-top: 1px solid $color-border;
  padding-top: $spacing-lg;
  margin-top: $spacing-md;

  h3 {
    margin: 0 0 $spacing-md 0;
    font-size: 1rem;
    color: #fff;
  }
}

.export-preview {
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-bottom: $spacing-md;

  @include mobile {
    padding: 0.75rem;
  }
}

.export-header {
  text-align: center;
  margin-bottom: $spacing-md;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid $color-border;
}

.export-title {
  display: block;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.1em;

  @include mobile {
    font-size: 1rem;
  }
}

.export-subtitle {
  display: block;
  font-size: 0.85rem;
  color: $color-danger;
  margin-top: $spacing-xs;

  @include mobile {
    font-size: 0.8rem;
  }
}

.export-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;

  @include mobile-lg {
    flex-wrap: wrap;
    gap: $spacing-sm;
  }
}

.btn-export {
  padding: 0.6rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.4rem;

  @include tablet {
    padding: $spacing-sm $spacing-md;
    font-size: 0.85rem;
  }

  @include mobile-lg {
    padding: 0.45rem 0.875rem;
    font-size: 0.8rem;
    flex: 1;
    min-width: 120px;
    justify-content: center;
  }

  @include mobile {
    padding: 0.4rem 0.75rem;
    font-size: 0.75rem;
  }
}

.btn-clipboard {
  background: #4a4a8a;
  color: #fff;

  &:hover {
    background: #5a5a9a;
  }
}

.btn-png {
  background: $color-success;
  color: $color-bg-secondary;

  &:hover {
    background: #6ee7a0;
  }
}

.btn-associate {
  background: $color-warning;
  color: $color-bg-secondary;

  &:hover {
    background: #fdba74;
  }
}
</style>
