<script setup lang="ts">
import { ref, computed } from 'vue';
import { posteColors, joueurs as allJoueurs } from '../data/config';
import type { MapConfig, Joueur } from '../types';

const props = defineProps<{
  maps: MapConfig[];
  joueurs: Joueur[];
}>();

defineEmits<{
  close: [];
}>();

const selectedAbsentJoueur = ref<string | null>(null);
const selectedMaps = ref<string[]>(props.maps.map(m => m.id));
const results = ref<MapResult[] | null>(null);
const hasCalculated = ref(false);

// Configurations sélectionnées par map (mapId -> index de la configuration)
const selectedConfigurations = ref<Record<string, number>>({});

// Ref pour le contenu exportable
const exportContentRef = ref<HTMLDivElement | null>(null);

interface ConfigurationResult {
  assignments: Record<string, string>; // posteId -> joueurId
}

interface MapResult {
  mapId: string;
  mapName: string;
  configurations: ConfigurationResult[];
  errors: string[];
}

// Sélectionner/désélectionner toutes les maps
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

// Algorithme de calcul des configurations valides
function calculateConfigurations() {
  if (!selectedAbsentJoueur.value) return;

  hasCalculated.value = true;
  results.value = [];
  selectedConfigurations.value = {}; // Réinitialiser les sélections

  const presentJoueurs = allJoueurs
    .filter(j => j.id !== selectedAbsentJoueur.value)
    .map(j => j.id);

  for (const mapId of selectedMaps.value) {
    const map = props.maps.find(m => m.id === mapId);
    if (!map) continue;

    const mapResult: MapResult = {
      mapId: map.id,
      mapName: map.nom,
      configurations: [],
      errors: []
    };

    // Récupérer les postes de la map
    const postes = map.postes.map(p => p.id);

    // Pour chaque joueur présent, quels postes peut-il occuper ?
    const joueurToPostes: Record<string, string[]> = {};
    for (const joueurId of presentJoueurs) {
      joueurToPostes[joueurId] = (map.joueurs[joueurId] || []).filter(p => postes.includes(p));
    }

    // Vérifier les erreurs de base
    for (const posteId of postes) {
      const joueursPourPoste = presentJoueurs.filter(j =>
        joueurToPostes[j]?.includes(posteId)
      );
      if (joueursPourPoste.length === 0) {
        const poste = map.postes.find(p => p.id === posteId);
        mapResult.errors.push(`${poste?.nom || posteId} ne peut être occupé par aucun joueur présent`);
      }
    }

    if (mapResult.errors.length > 0) {
      results.value.push(mapResult);
      continue;
    }

    // Trouver toutes les configurations valides (backtracking)
    const configurations = findAllConfigurations(postes, presentJoueurs, joueurToPostes);

    if (configurations.length === 0) {
      mapResult.errors.push("Aucune configuration valide trouvée");
    } else {
      mapResult.configurations = configurations;
      // Sélectionner automatiquement la première configuration
      selectedConfigurations.value[mapResult.mapId] = 0;
    }

    results.value.push(mapResult);
  }
}

// Algorithme de backtracking pour trouver toutes les configurations
function findAllConfigurations(
  postes: string[],
  joueurs: string[],
  joueurToPostes: Record<string, string[]>
): ConfigurationResult[] {
  const results: ConfigurationResult[] = [];
  const assignment: Record<string, string> = {};
  const usedJoueurs = new Set<string>();

  function backtrack(posteIndex: number) {
    if (posteIndex === postes.length) {
      // Configuration complète trouvée
      results.push({ assignments: { ...assignment } });
      return;
    }

    const posteId = postes[posteIndex];
    if (!posteId) return;

    for (const joueurId of joueurs) {
      if (usedJoueurs.has(joueurId)) continue;
      const joueurPostes = joueurToPostes[joueurId];
      if (!joueurPostes || !joueurPostes.includes(posteId)) continue;

      // Assigner ce joueur à ce poste
      assignment[posteId] = joueurId;
      usedJoueurs.add(joueurId);

      backtrack(posteIndex + 1);

      // Backtrack
      delete assignment[posteId];
      usedJoueurs.delete(joueurId);
    }
  }

  backtrack(0);
  return results;
}

// Helpers pour l'affichage
function getJoueurNom(joueurId: string): string {
  return allJoueurs.find(j => j.id === joueurId)?.nom || joueurId;
}

function getPosteNom(mapId: string, posteId: string): string {
  const map = props.maps.find(m => m.id === mapId);
  return map?.postes.find(p => p.id === posteId)?.nom || posteId;
}

function getPosteColor(posteId: string): string {
  return posteColors[posteId] || '#888';
}

const canCalculate = computed(() => {
  return selectedAbsentJoueur.value && selectedMaps.value.length > 0;
});

// Sélectionne une configuration pour une map
function selectConfiguration(mapId: string, configIndex: number) {
  selectedConfigurations.value[mapId] = configIndex;
}

// Vérifie si une configuration est sélectionnée
function isConfigSelected(mapId: string, configIndex: number): boolean {
  return selectedConfigurations.value[mapId] === configIndex;
}

// Vérifie si toutes les maps valides ont une configuration sélectionnée
const canExport = computed(() => {
  if (!results.value) return false;
  const validMaps = results.value.filter(r => r.errors.length === 0 && r.configurations.length > 0);
  if (validMaps.length === 0) return false;
  return validMaps.every(r => selectedConfigurations.value[r.mapId] !== undefined);
});

// Maps exportables avec leur configuration sélectionnée
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
        assignments: config ? Object.entries(config.assignments).map(([posteId, joueurId]) => ({
          posteId,
          joueurId,
          posteName: getPosteNom(r.mapId, posteId),
          joueurName: getJoueurNom(joueurId),
          posteColor: getPosteColor(posteId)
        })) : []
      };
    })
    .filter(m => m.assignments.length > 0);
});

// Joueurs présents (tous sauf l'absent)
const presentJoueurs = computed(() => {
  if (!selectedAbsentJoueur.value) return [];
  return allJoueurs.filter(j => j.id !== selectedAbsentJoueur.value);
});

// Données du tableau pour l'export (map -> joueur -> poste)
const tableData = computed(() => {
  if (!exportableMaps.value.length) return [];

  return exportableMaps.value.map(mapData => {
    const row: Record<string, { posteName: string; posteColor: string } | null> = {};

    // Pour chaque joueur présent, trouver son poste sur cette map
    for (const joueur of presentJoueurs.value) {
      const assignment = mapData.assignments.find(a => a.joueurId === joueur.id);
      if (assignment) {
        row[joueur.id] = {
          posteName: assignment.posteName,
          posteColor: assignment.posteColor
        };
      } else {
        row[joueur.id] = null;
      }
    }

    return {
      mapId: mapData.mapId,
      mapName: mapData.mapName,
      joueurs: row
    };
  });
});

// Génère le texte formaté pour l'export (format tableau)
function generateExportText(): string {
  if (!results.value || !selectedAbsentJoueur.value || !tableData.value.length) return '';

  const absentName = getJoueurNom(selectedAbsentJoueur.value);
  const joueurs = presentJoueurs.value;

  // Calculer les largeurs de colonnes
  const mapColWidth = Math.max(10, ...tableData.value.map(r => r.mapName.length)) + 2;
  const joueurColWidth = Math.max(8, ...joueurs.map(j => j.nom.length)) + 2;

  let text = `\n  PLAN DE JEU - ${absentName} absent(e)\n`;
  text += `${'═'.repeat(mapColWidth + joueurColWidth * joueurs.length + joueurs.length + 1)}\n\n`;

  // En-tête
  text += `  ${'Map'.padEnd(mapColWidth)}`;
  for (const joueur of joueurs) {
    text += `│ ${joueur.nom.padEnd(joueurColWidth - 2)} `;
  }
  text += `\n`;

  // Ligne de séparation
  text += `  ${'─'.repeat(mapColWidth)}`;
  for (let i = 0; i < joueurs.length; i++) {
    text += `┼${'─'.repeat(joueurColWidth)}`;
  }
  text += `\n`;

  // Données
  for (const row of tableData.value) {
    text += `  ${row.mapName.padEnd(mapColWidth)}`;
    for (const joueur of joueurs) {
      const cell = row.joueurs[joueur.id];
      const cellText = cell ? cell.posteName : '-';
      text += `│ ${cellText.padEnd(joueurColWidth - 2)} `;
    }
    text += `\n`;
  }

  text += `\n`;

  return text;
}

// Export en texte (presse-papier)
async function exportToClipboard() {
  const text = generateExportText();
  try {
    await navigator.clipboard.writeText(text);
    alert('Plan de jeu copié dans le presse-papier !');
  } catch (err) {
    console.error('Erreur de copie:', err);
    alert('Erreur lors de la copie');
  }
}

// Export en PNG
async function exportToPng() {
  if (!exportContentRef.value) return;

  try {
    // Import dynamique de html2canvas
    const html2canvas = (await import('html2canvas')).default;

    const canvas = await html2canvas(exportContentRef.value, {
      backgroundColor: '#1a1a2e',
      scale: 2,
    });

    const link = document.createElement('a');
    link.download = `plan-de-jeu-${selectedAbsentJoueur.value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Erreur export PNG:', err);
    alert('Erreur lors de l\'export PNG. Assurez-vous que html2canvas est installé.');
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Calculateur de rotation</h2>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Sélection du joueur absent -->
        <div class="form-group">
          <label>Joueur(se) absent(e) :</label>
          <div class="joueur-selector">
            <button
              v-for="joueur in joueurs"
              :key="joueur.id"
              :class="{ active: selectedAbsentJoueur === joueur.id }"
              @click="selectedAbsentJoueur = joueur.id"
            >
              {{ joueur.nom }}
            </button>
          </div>
        </div>

        <!-- Sélection des maps -->
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
              {{ map.nom }}
            </label>
          </div>
        </div>

        <!-- Bouton calculer -->
        <button
          class="btn-calculate"
          :disabled="!canCalculate"
          @click="calculateConfigurations"
        >
          Calculer
        </button>

        <!-- Résultats -->
        <div v-if="hasCalculated && results" class="results">
          <div
            v-for="result in results"
            :key="result.mapId"
            class="result-card"
            :class="{ 'has-errors': result.errors.length > 0 }"
          >
            <h3>{{ result.mapName }}</h3>

            <!-- Erreurs -->
            <div v-if="result.errors.length > 0" class="result-errors">
              <div v-for="(error, i) in result.errors" :key="i" class="error-row">
                <span class="error-icon">⚠</span>
                <span>{{ error }}</span>
              </div>
            </div>

            <!-- Configurations valides -->
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
                  v-for="(joueurId, posteId) in config.assignments"
                  :key="posteId"
                  class="assignment"
                >
                  <span
                    class="poste-tag"
                    :style="{
                      borderColor: getPosteColor(posteId as string),
                      color: getPosteColor(posteId as string)
                    }"
                  >
                    {{ getPosteNom(result.mapId, posteId as string) }}
                  </span>
                  <span class="joueur-name">{{ getJoueurNom(joueurId) }}</span>
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

<!-- Section Export -->
        <div v-if="hasCalculated && results && canExport" class="export-section">
          <h3>Générer le plan de jeu</h3>

          <!-- Prévisualisation sous forme de tableau -->
          <div ref="exportContentRef" class="export-preview">
            <div class="export-header">
              <span class="export-title">PLAN DE JEU</span>
              <span class="export-subtitle">{{ getJoueurNom(selectedAbsentJoueur!) }} absent(e)</span>
            </div>

            <!-- Tableau Map / Joueurs -->
            <table class="export-table">
              <thead>
                <tr>
                  <th class="col-map">Map</th>
                  <th
                    v-for="joueur in presentJoueurs"
                    :key="joueur.id"
                    class="col-joueur"
                  >
                    {{ joueur.nom }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in tableData" :key="row.mapId">
                  <td class="col-map">{{ row.mapName }}</td>
                  <td
                    v-for="joueur in presentJoueurs"
                    :key="joueur.id"
                    class="col-joueur"
                  >
                    <span
                      v-if="row.joueurs[joueur.id]"
                      class="cell-poste"
                      :style="{
                        color: row.joueurs[joueur.id]?.posteColor,
                        borderColor: row.joueurs[joueur.id]?.posteColor
                      }"
                    >
                      {{ row.joueurs[joueur.id]?.posteName }}
                    </span>
                    <span v-else class="cell-empty">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Boutons d'export -->
          <div class="export-buttons">
            <button class="btn-export btn-clipboard" @click="exportToClipboard">
              📋 Copier (texte)
            </button>
            <button class="btn-export btn-png" @click="exportToPng">
              🖼️ Télécharger (PNG)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
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
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #333;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #fff;
}

.btn-close {
  background: transparent;
  border: none;
  color: #888;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: #aaa;
  font-size: 0.9rem;
  font-weight: 600;
}

.joueur-selector {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.joueur-selector button {
  padding: 0.4rem 0.8rem;
  border: 2px solid #666;
  background: transparent;
  color: #ccc;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.joueur-selector button:hover {
  background: #3a3a5a;
  border-color: #888;
}

.joueur-selector button.active {
  background: #ff6b6b;
  border-color: #ff6b6b;
  color: #fff;
}

.maps-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.maps-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-small {
  padding: 0.2rem 0.5rem;
  background: #2a2a4a;
  border: 1px solid #444;
  color: #aaa;
  border-radius: 3px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-small:hover {
  background: #3a3a5a;
  color: #fff;
}

.maps-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.map-checkbox {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  background: #2a2a4a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #aaa;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.map-checkbox:hover {
  background: #3a3a5a;
  border-color: #666;
}

.map-checkbox.checked {
  background: rgba(74, 222, 128, 0.2);
  border-color: #4ade80;
  color: #4ade80;
}

.map-checkbox input {
  display: none;
}

.btn-calculate {
  padding: 0.75rem 1.5rem;
  background: #4ade80;
  border: none;
  border-radius: 6px;
  color: #1a1a2e;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  align-self: center;
}

.btn-calculate:hover:not(:disabled) {
  background: #6ee7a0;
  transform: translateY(-1px);
}

.btn-calculate:disabled {
  background: #444;
  color: #888;
  cursor: not-allowed;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-top: 1px solid #333;
  padding-top: 1.5rem;
}

.result-card {
  background: #252540;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 1rem;
}

.result-card.has-errors {
  border-color: rgba(255, 107, 107, 0.5);
}

.result-card h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: #fff;
}

.result-errors {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.error-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ff6b6b;
  font-size: 0.85rem;
}

.error-icon {
  flex-shrink: 0;
}

.result-configurations {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.config-count {
  color: #4ade80;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.configuration {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.5rem;
  background: #1a1a2e;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  align-items: center;
}

.configuration:hover {
  background: #252545;
  border-color: #444;
}

.configuration.selected {
  background: rgba(74, 222, 128, 0.1);
  border-color: #4ade80;
}

.config-selector {
  color: #666;
  font-size: 0.9rem;
  margin-right: 0.25rem;
}

.configuration.selected .config-selector {
  color: #4ade80;
}

.assignment {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.poste-tag {
  padding: 0.15rem 0.4rem;
  border: 1px solid;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
}

.joueur-name {
  color: #fff;
  font-size: 0.85rem;
}

.more-configs {
  color: #888;
  font-size: 0.8rem;
  font-style: italic;
  padding-top: 0.25rem;
}

/* Section Export */
.export-section {
  border-top: 1px solid #333;
  padding-top: 1.5rem;
  margin-top: 1rem;
}

.export-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #fff;
}

.export-preview {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.export-header {
  text-align: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #333;
}

.export-title {
  display: block;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.1em;
}

.export-subtitle {
  display: block;
  font-size: 0.85rem;
  color: #ff6b6b;
  margin-top: 0.25rem;
}

/* Tableau d'export */
.export-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.export-table th,
.export-table td {
  padding: 0.5rem 0.75rem;
  text-align: center;
  border: 1px solid #333;
}

.export-table th {
  background: #252540;
  color: #fff;
  font-weight: 600;
}

.export-table th.col-map {
  text-align: left;
  width: 120px;
}

.export-table td.col-map {
  text-align: left;
  font-weight: 600;
  color: #fff;
  background: #1f1f35;
}

.export-table tbody tr:nth-child(odd) {
  background: rgba(255, 255, 255, 0.02);
}

.export-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

.cell-poste {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border: 1px solid;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.8rem;
}

.cell-empty {
  color: #555;
}

.export-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
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
}

.btn-clipboard {
  background: #4a4a8a;
  color: #fff;
}

.btn-clipboard:hover {
  background: #5a5a9a;
}

.btn-png {
  background: #4ade80;
  color: #1a1a2e;
}

.btn-png:hover {
  background: #6ee7a0;
}
</style>

