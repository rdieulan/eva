<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import MapList from './components/MapList.vue';
import TopBar from './components/TopBar.vue';
import MapViewer from './components/MapViewer.vue';
import { loadAllMaps, joueurs } from './data/config';
import type { MapConfig } from './types';

const selectedMapId = ref<string | null>(null);
const selectedJoueurId = ref<string | null>(null);
const activePostes = ref<string[]>([]);
const editMode = ref(false);
const isLoading = ref(true);

// Maps chargées depuis les fichiers JSON
const maps = ref<MapConfig[]>([]);

// Copie modifiable des maps pour l'édition
const editableMaps = ref<MapConfig[]>([]);

// Charger les maps au démarrage
onMounted(async () => {
  try {
    maps.value = await loadAllMaps();
    editableMaps.value = JSON.parse(JSON.stringify(maps.value));
    const firstMap = maps.value[0];
    if (firstMap) {
      selectedMapId.value = firstMap.id;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des maps:', error);
  } finally {
    isLoading.value = false;
  }
});

const currentMap = computed(() => {
  const source = editMode.value ? editableMaps.value : maps.value;
  return source.find(m => m.id === selectedMapId.value) || null;
});

function selectMap(mapId: string) {
  selectedMapId.value = mapId;
}

function selectJoueur(joueurId: string | null) {
  const newJoueurId = selectedJoueurId.value === joueurId ? null : joueurId;
  selectedJoueurId.value = newJoueurId;

  // Réinitialiser la sélection de poste quand on change de joueur
  activePostes.value = [];
}

// Toggle un poste actif/inactif (un seul à la fois)
function togglePoste(posteId: string) {
  if (activePostes.value.includes(posteId)) {
    // Désélectionner si déjà sélectionné
    activePostes.value = [];
  } else {
    // Sélectionner ce poste uniquement
    activePostes.value = [posteId];
  }
}

// Quand on change de map, réinitialiser les postes actifs
watch(selectedMapId, () => {
  activePostes.value = [];
});

function toggleEditMode() {
  if (!editMode.value) {
    // Entrer en mode édition : copier les maps actuelles
    editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  }
  editMode.value = !editMode.value;
}

function handleMapUpdate(updatedMap: MapConfig) {
  const index = editableMaps.value.findIndex(m => m.id === updatedMap.id);
  if (index !== -1) {
    editableMaps.value[index] = updatedMap;
  }
}

// Quand on modifie l'association joueur/poste en mode édition
function handlePlayerPosteChanged(_playerId: string, posteId: string, associated: boolean) {
  // Si le poste sélectionné est dissocié, le désélectionner
  if (!associated && activePostes.value.includes(posteId)) {
    activePostes.value = [];
  }
}

async function saveChanges() {
  const mapToSave = editableMaps.value.find(m => m.id === selectedMapId.value);
  if (!mapToSave) return;

  try {
    const response = await fetch(`http://localhost:3001/api/maps/${mapToSave.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mapToSave),
    });

    const result = await response.json();

    if (result.success) {
      // Mettre à jour les maps en mémoire
      const index = maps.value.findIndex(m => m.id === mapToSave.id);
      if (index !== -1) {
        maps.value[index] = JSON.parse(JSON.stringify(mapToSave));
      }
      alert(`✅ Map "${mapToSave.nom}" sauvegardée !`);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erreur:', error);
    // Fallback: télécharger le fichier si le serveur n'est pas disponible
    const json = JSON.stringify(mapToSave, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapToSave.id}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`⚠️ Serveur non disponible.\n\nLe fichier a été téléchargé.\nPlacez-le dans: public/maps/${mapToSave.id}/${mapToSave.id}.json\n\nPour activer la sauvegarde directe, lancez:\nnode server.js`);
  }
}

function cancelEdit() {
  editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  editMode.value = false;
}
</script>

<template>
  <div class="app">
    <!-- État de chargement -->
    <div v-if="isLoading" class="loading">
      Chargement des maps...
    </div>

    <template v-else>
      <!-- Barre supérieure unifiée -->
      <TopBar
        :joueurs="joueurs"
        :selectedJoueurId="selectedJoueurId"
        :map="currentMap"
        :activePostes="activePostes"
        :editMode="editMode"
        :isLoading="isLoading"
        @select-joueur="selectJoueur"
        @toggle-poste="togglePoste"
        @toggle-edit="toggleEditMode"
        @save="saveChanges"
        @cancel="cancelEdit"
      />

      <div class="main-content">
        <!-- Liste des maps à gauche -->
        <MapList
          :maps="maps"
          :selectedMapId="selectedMapId"
          @select="selectMap"
        />

        <!-- Viewer de la map au centre -->
        <MapViewer
          v-if="currentMap"
          :map="currentMap"
          :joueurs="joueurs"
          :selectedJoueurId="selectedJoueurId"
          :activePostes="activePostes"
          :editMode="editMode"
          @update:map="handleMapUpdate"
          @player-poste-changed="handlePlayerPosteChanged"
        />

        <div v-else class="no-map">
          Sélectionnez une map
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #0f0f1a;
  overflow: hidden;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.no-map {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 1.5rem;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 1.5rem;
}
</style>
