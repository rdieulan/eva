<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import MapList from '../components/MapList.vue';
import MapViewer from '../components/MapViewer.vue';
import PlannerToolbar from '../components/planner/PlannerToolbar.vue';
import { loadAllMaps, joueurs } from '../data/config';
import { useAuth } from '../composables/useAuth';
import type { MapConfig } from '../types';

const { permissions, user } = useAuth();

// Debug: vérifier les permissions
const canEdit = computed(() => {
  console.log('User:', user.value);
  console.log('Permissions:', permissions.value);
  return permissions.value.canEdit;
});

const selectedMapId = ref<string | null>(null);
const selectedJoueurId = ref<string | null>(null);
const activePostes = ref<string[]>([]);
const editMode = ref(false);
const isLoading = ref(true);

const maps = ref<MapConfig[]>([]);
const editableMaps = ref<MapConfig[]>([]);

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

  const currentPoste = activePostes.value[0];
  if (currentPoste && newJoueurId && currentMap.value) {
    const joueurPostes = currentMap.value.joueurs[newJoueurId] || [];
    if (!joueurPostes.includes(currentPoste)) {
      activePostes.value = [];
    }
  }
}

function togglePoste(posteId: string) {
  if (activePostes.value.includes(posteId)) {
    activePostes.value = [];
  } else {
    activePostes.value = [posteId];
  }
}

function resetSelection() {
  selectedJoueurId.value = null;
  activePostes.value = [];
}

watch(selectedMapId, () => {
  activePostes.value = [];
});

function toggleEditMode() {
  if (!editMode.value) {
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

function handlePlayerPosteChanged(playerId: string, posteId: string, associated: boolean) {
  if (!associated && activePostes.value.includes(posteId) && selectedJoueurId.value === playerId) {
    activePostes.value = [];
  }
}

async function saveChanges() {
  const mapToSave = editableMaps.value.find(m => m.id === selectedMapId.value);
  if (!mapToSave) return;

  try {
    const response = await fetch(`http://localhost:3001/api/maps-dev/${mapToSave.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapToSave),
    });

    const result = await response.json();

    if (result.success) {
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
    const json = JSON.stringify(mapToSave, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapToSave.id}.json`;
    a.click();
    URL.revokeObjectURL(url);

    alert(`⚠️ Serveur non disponible. Le fichier a été téléchargé.`);
  }
}

function cancelEdit() {
  editableMaps.value = JSON.parse(JSON.stringify(maps.value));
  editMode.value = false;
}
</script>

<template>
  <div class="planner-page">
    <!-- Toolbar injectée dans la section dynamique de la TopBar -->
    <Teleport to="#topbar-dynamic-content">
      <PlannerToolbar
        :joueurs="joueurs"
        :selectedJoueurId="selectedJoueurId"
        :map="currentMap"
        :maps="maps"
        :activePostes="activePostes"
        :editMode="editMode"
        :isLoading="isLoading"
        :canEdit="canEdit"
        @select-joueur="selectJoueur"
        @toggle-poste="togglePoste"
        @toggle-edit="toggleEditMode"
        @save="saveChanges"
        @cancel="cancelEdit"
        @reset="resetSelection"
      />
    </Teleport>

    <!-- État de chargement -->
    <div v-if="isLoading" class="loading">
      Chargement des maps...
    </div>

    <template v-else>
      <div class="main-content">
        <MapList
          :maps="maps"
          :selectedMapId="selectedMapId"
          @select="selectMap"
        />

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
.planner-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
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
