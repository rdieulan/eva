<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MapConfig, Joueur, Point } from '../types';
import { posteColors } from '../data/config';
import { getZonePolygons } from '../types';

const props = defineProps<{
  map: MapConfig;
  joueurs: Joueur[];
  selectedJoueurId: string | null;
  activePostes: string[];
  editMode?: boolean;
}>();

const emit = defineEmits<{
  'update:map': [map: MapConfig];
  'player-poste-changed': [playerId: string, posteId: string, associated: boolean];
}>();

// État du chargement de l'image
const imageLoaded = ref(false);
const imageRef = ref<HTMLImageElement | null>(null);
const imageRatio = ref(1);

// Étage actuel pour les maps multi-étages
const currentEtage = ref(0);

// État pour le drag & drop en mode édition
const dragging = ref<{
  type: 'poste' | 'zone-move' | 'zone-point';
  posteId: string;
  polygonIndex?: number;
  pointIndex?: number;
} | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

// État pour le panneau d'édition des joueurs
const editingPosteId = ref<string | null>(null);
const editPanelPosition = ref({ x: 0, y: 0 });

// Reset l'étage quand on change de map
watch(() => props.map.id, () => {
  currentEtage.value = 0;
  imageLoaded.value = false;
});

// Gestion du chargement de l'image
function onImageLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  imageRef.value = img;
  // Ratio pour compenser la déformation du SVG (width / height)
  imageRatio.value = img.naturalWidth / img.naturalHeight;
  imageLoaded.value = true;
}

// Nombre d'étages de la map
const hasMultipleFloors = computed(() => props.map.images.length > 1);

// Image actuelle
const currentImage = computed(() => props.map.images[currentEtage.value]);

// Reset imageLoaded quand on change d'étage
watch(currentImage, () => {
  imageLoaded.value = false;
});

// Postes visibles sur l'étage actuel
const visiblePostes = computed(() => {
  if (!hasMultipleFloors.value) return props.map.postes;
  return props.map.postes.filter(p => p.etage === undefined || p.etage === currentEtage.value);
});

// Postes des autres étages (pour affichage fantôme quand joueur sélectionné)
const ghostPostes = computed(() => {
  if (!hasMultipleFloors.value || !props.selectedJoueurId) return [];
  return props.map.postes
    .filter(p => p.etage !== undefined && p.etage !== currentEtage.value)
    .filter(p => props.activePostes.includes(p.id));
});

// Récupère la couleur d'un poste
function getPosteColor(posteId: string): string {
  return posteColors[posteId] || '#888';
}

// Vérifie si un poste est actif
function isPosteActive(posteId: string): boolean {
  return props.activePostes.includes(posteId);
}

// === Mode édition ===

// Convertit les coordonnées de la souris en coordonnées SVG (0-100)
function getSvgCoords(event: MouseEvent): { x: number; y: number } {
  if (!svgRef.value) return { x: 0, y: 0 };

  const svg = svgRef.value;
  const rect = svg.getBoundingClientRect();

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

// Démarre le drag d'une pastille
function startDragPoste(event: MouseEvent, posteId: string) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();
  dragging.value = { type: 'poste', posteId };
}

// Démarre le drag d'une zone (déplacement)
function startDragZone(event: MouseEvent, posteId: string, polygonIndex: number = 0) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();
  dragging.value = { type: 'zone-move', posteId, polygonIndex };
}

// Démarre le drag d'un point de zone
function startDragZonePoint(event: MouseEvent, posteId: string, polygonIndex: number, pointIndex: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();
  dragging.value = { type: 'zone-point', posteId, polygonIndex, pointIndex };
}

// Ajoute un point sur un côté du polygone
function addPointOnEdge(event: MouseEvent, posteId: string, polygonIndex: number, edgeIndex: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();

  const coords = getSvgCoords(event);
  const posteIndex = props.map.postes.findIndex(p => p.id === posteId);
  if (posteIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const poste = updatedMap.postes[posteIndex];
  if (!poste) return;

  // Convertir en multi-zone si nécessaire
  const polygons = getZonePolygons(poste.zone);
  const targetPolygon = polygons[polygonIndex];
  if (!targetPolygon) return;

  // Insérer le nouveau point après l'index du côté
  const newPoint: Point = {
    x: Math.round(coords.x * 10) / 10,
    y: Math.round(coords.y * 10) / 10
  };
  targetPolygon.splice(edgeIndex + 1, 0, newPoint);

  poste.zone = { polygons };
  emit('update:map', updatedMap);

  // Commencer à drag le nouveau point
  dragging.value = { type: 'zone-point', posteId, polygonIndex, pointIndex: edgeIndex + 1 };
}

// Supprime un point du polygone (minimum 3 points)
function removePoint(event: MouseEvent, posteId: string, polygonIndex: number, pointIndex: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();

  const posteIndex = props.map.postes.findIndex(p => p.id === posteId);
  if (posteIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const poste = updatedMap.postes[posteIndex];
  if (!poste) return;

  const polygons = getZonePolygons(poste.zone);
  const targetPolygon = polygons[polygonIndex];
  if (!targetPolygon || targetPolygon.length <= 3) return; // Minimum 3 points pour un polygone

  targetPolygon.splice(pointIndex, 1);
  poste.zone = { polygons };
  emit('update:map', updatedMap);
}

// Ajoute un nouveau morceau de zone (polygone rectangle par défaut)
function addZonePolygon(event: MouseEvent, posteId: string) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();

  const coords = getSvgCoords(event);
  const posteIndex = props.map.postes.findIndex(p => p.id === posteId);
  if (posteIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const poste = updatedMap.postes[posteIndex];
  if (!poste) return;

  // Récupérer les polygones existants
  const polygons = getZonePolygons(poste.zone);

  // Créer un nouveau rectangle centré sur le clic
  const size = 5;
  const newPolygon: Point[] = [
    { x: Math.round((coords.x - size) * 10) / 10, y: Math.round((coords.y - size) * 10) / 10 },
    { x: Math.round((coords.x + size) * 10) / 10, y: Math.round((coords.y - size) * 10) / 10 },
    { x: Math.round((coords.x + size) * 10) / 10, y: Math.round((coords.y + size) * 10) / 10 },
    { x: Math.round((coords.x - size) * 10) / 10, y: Math.round((coords.y + size) * 10) / 10 },
  ];

  polygons.push(newPolygon);
  poste.zone = { polygons };
  emit('update:map', updatedMap);
}

// Supprime un morceau de zone entier (si plus d'un polygone)
function removeZonePolygon(event: MouseEvent, posteId: string, polygonIndex: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();

  const posteIndex = props.map.postes.findIndex(p => p.id === posteId);
  if (posteIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const poste = updatedMap.postes[posteIndex];
  if (!poste) return;

  const polygons = getZonePolygons(poste.zone);
  if (polygons.length <= 1) return; // Au moins un polygone doit rester

  polygons.splice(polygonIndex, 1);
  poste.zone = { polygons };
  emit('update:map', updatedMap);
}

// Gère le mouvement pendant le drag
function handleMouseMove(event: MouseEvent) {
  if (!dragging.value || !props.editMode) return;

  const coords = getSvgCoords(event);
  const posteIndex = props.map.postes.findIndex(p => p.id === dragging.value!.posteId);
  if (posteIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const poste = updatedMap.postes[posteIndex];
  if (!poste) return;

  if (dragging.value.type === 'poste') {
    // Déplacer la pastille
    poste.x = Math.round(coords.x * 10) / 10;
    poste.y = Math.round(coords.y * 10) / 10;
  } else if (dragging.value.type === 'zone-move') {
    // Déplacer un polygone spécifique de la zone
    const polygons = getZonePolygons(poste.zone);
    const polygonIndex = dragging.value.polygonIndex ?? 0;
    const points = polygons[polygonIndex];
    if (!points) return;

    // Calculer le centre actuel
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    // Calculer le décalage
    const dx = coords.x - centerX;
    const dy = coords.y - centerY;

    // Appliquer le décalage à tous les points du polygone
    polygons[polygonIndex] = points.map(p => ({
      x: Math.round((p.x + dx) * 10) / 10,
      y: Math.round((p.y + dy) * 10) / 10,
    }));

    poste.zone = { polygons };
  } else if (dragging.value.type === 'zone-point' && dragging.value.pointIndex !== undefined) {
    // Déplacer un point spécifique
    const polygons = getZonePolygons(poste.zone);
    const polygonIndex = dragging.value.polygonIndex ?? 0;
    const points = polygons[polygonIndex];
    const pointIndex = dragging.value.pointIndex;

    if (points && pointIndex >= 0 && pointIndex < points.length) {
      points[pointIndex] = {
        x: Math.round(coords.x * 10) / 10,
        y: Math.round(coords.y * 10) / 10,
      };
      polygons[polygonIndex] = points;
      poste.zone = { polygons };
    }
  }

  emit('update:map', updatedMap);
}

// Arrête le drag
function handleMouseUp() {
  dragging.value = null;
}

// Ouvre le panneau d'édition des joueurs pour un poste
function openPlayerEditPanel(event: MouseEvent, posteId: string) {
  if (!props.editMode) return;

  // Ne pas ouvrir si on était en train de drag
  if (dragging.value) return;

  event.preventDefault();
  event.stopPropagation();

  editingPosteId.value = posteId;
  editPanelPosition.value = { x: event.clientX, y: event.clientY };
}

// Ferme le panneau d'édition
function closePlayerEditPanel() {
  editingPosteId.value = null;
}

// Vérifie si un joueur est associé à un poste
function isPlayerAssociatedToPoste(playerId: string, posteId: string): boolean {
  const playerPostes = props.map.joueurs[playerId];
  return playerPostes ? playerPostes.includes(posteId) : false;
}

// Toggle l'association d'un joueur à un poste
function togglePlayerPosteAssociation(playerId: string, posteId: string) {
  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;

  if (!updatedMap.joueurs[playerId]) {
    updatedMap.joueurs[playerId] = [];
  }

  const playerPostes = updatedMap.joueurs[playerId];
  const index = playerPostes.indexOf(posteId);

  let associated: boolean;
  if (index === -1) {
    playerPostes.push(posteId);
    associated = true;
  } else {
    playerPostes.splice(index, 1);
    associated = false;
  }

  emit('update:map', updatedMap);
  emit('player-poste-changed', playerId, posteId, associated);
}

// Récupère le nom du poste en cours d'édition
const editingPosteName = computed(() => {
  if (!editingPosteId.value) return '';
  const poste = props.map.postes.find(p => p.id === editingPosteId.value);
  return poste?.nom || editingPosteId.value;
});

// Génère le path SVG d'un polygone à partir des points
function getPolygonPathFromPoints(points: Point[]): string {
  if (points.length < 3) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
}

// Génère les données pour les côtés d'un polygone (pour ajouter des points)
function getPolygonEdges(points: Point[]): { x1: number; y1: number; x2: number; y2: number; midX: number; midY: number }[] {
  const edges: { x1: number; y1: number; x2: number; y2: number; midX: number; midY: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % points.length]!;
    edges.push({
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      midX: (p1.x + p2.x) / 2,
      midY: (p1.y + p2.y) / 2,
    });
  }

  return edges;
}
</script>

<template>
  <div class="map-viewer">
    <!-- Sélecteur d'étage pour les maps multi-étages -->
    <div v-if="hasMultipleFloors" class="floor-selector">
      <button
        v-for="(image, index) in map.images"
        :key="image"
        :class="{ active: currentEtage === index }"
        @click="currentEtage = index"
      >
        {{ index === 0 ? 'RDC' : `Étage ${index}` }}
      </button>
    </div>

    <!-- Image de la map -->
    <div class="map-container">
      <img
        :src="currentImage"
        :alt="map.nom"
        class="map-image"
        @load="onImageLoad"
      />

      <!-- Layer SVG pour les overlays - même viewBox que les coordonnées en % -->
      <svg
        v-if="imageLoaded"
        ref="svgRef"
        class="overlay"
        :class="{ 'edit-mode': editMode }"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
      >
        <!-- Zones de contrôle des postes actifs de l'étage actuel -->
        <g v-for="poste in visiblePostes.filter(p => isPosteActive(p.id))" :key="'zone-' + poste.id">
          <!-- Tous les polygones de la zone -->
          <g
            v-for="(polygon, polygonIndex) in getZonePolygons(poste.zone)"
            :key="'polygon-' + polygonIndex"
          >
            <path
              :d="getPolygonPathFromPoints(polygon)"
              class="zone active"
              :class="{ editable: editMode }"
              :style="{ '--zone-color': getPosteColor(poste.id) }"
              @mousedown="startDragZone($event, poste.id, polygonIndex)"
              @contextmenu="openPlayerEditPanel($event, poste.id)"
              @dblclick="editMode && addZonePolygon($event, poste.id)"
            />
            <!-- Poignées des points en mode édition -->
            <template v-if="editMode">
              <!-- Indicateur de suppression de polygone (si plus d'un) -->
              <text
                v-if="getZonePolygons(poste.zone).length > 1"
                :x="polygon.reduce((s, p) => s + p.x, 0) / polygon.length"
                :y="polygon.reduce((s, p) => s + p.y, 0) / polygon.length"
                class="remove-polygon-btn"
                @click="removeZonePolygon($event, poste.id, polygonIndex)"
              >✕</text>
              <!-- Points du polygone -->
              <circle
                v-for="(point, pointIndex) in polygon"
                :key="'point-' + pointIndex"
                :cx="point.x"
                :cy="point.y"
                r="1.2"
                class="point-handle"
                @mousedown="startDragZonePoint($event, poste.id, polygonIndex, pointIndex)"
                @contextmenu.prevent="removePoint($event, poste.id, polygonIndex, pointIndex)"
              />
              <!-- Boutons pour ajouter des points sur les côtés -->
              <circle
                v-for="(edge, edgeIndex) in getPolygonEdges(polygon)"
                :key="'add-point-' + edgeIndex"
                :cx="edge.midX"
                :cy="edge.midY"
                r="0.8"
                class="add-point-handle"
                @mousedown="addPointOnEdge($event, poste.id, polygonIndex, edgeIndex)"
              />
            </template>
          </g>
        </g>

        <!-- Zones fantômes (autres étages) -->
        <g v-for="poste in ghostPostes" :key="'ghost-zone-' + poste.id">
          <path
            v-for="(polygon, polygonIndex) in getZonePolygons(poste.zone)"
            :key="'ghost-polygon-' + polygonIndex"
            :d="getPolygonPathFromPoints(polygon)"
            class="zone ghost"
            :style="{ '--zone-color': getPosteColor(poste.id) }"
          />
        </g>


        <!-- Pastilles des postes actifs de l'étage actuel -->
        <g v-for="poste in visiblePostes.filter(p => isPosteActive(p.id))" :key="'poste-' + poste.id">
          <ellipse
            :cx="poste.x"
            :cy="poste.y"
            :rx="1.5"
            :ry="1.5 * imageRatio"
            class="poste active"
            :class="{ editable: editMode }"
            :style="{ '--poste-color': getPosteColor(poste.id) }"
            @mousedown="startDragPoste($event, poste.id)"
            @contextmenu="openPlayerEditPanel($event, poste.id)"
          />
        </g>

        <!-- Pastilles fantômes (autres étages) -->
        <g v-for="poste in ghostPostes" :key="'ghost-poste-' + poste.id">
          <ellipse
            :cx="poste.x"
            :cy="poste.y"
            :rx="1.5"
            :ry="1.5 * imageRatio"
            class="poste ghost"
            :style="{ '--poste-color': getPosteColor(poste.id) }"
          />
        </g>
      </svg>

      <!-- Panneau d'édition des joueurs associés -->
      <div
        v-if="editMode && editingPosteId"
        class="player-edit-panel"
        :style="{ left: editPanelPosition.x + 'px', top: editPanelPosition.y + 'px' }"
      >
        <div class="panel-header">
          <span class="panel-title" :style="{ color: getPosteColor(editingPosteId) }">
            {{ editingPosteName }}
          </span>
          <button class="panel-close" @click="closePlayerEditPanel">✕</button>
        </div>
        <div class="panel-content">
          <label
            v-for="joueur in joueurs"
            :key="joueur.id"
            class="player-checkbox"
            :class="{ checked: isPlayerAssociatedToPoste(joueur.id, editingPosteId) }"
          >
            <input
              type="checkbox"
              :checked="isPlayerAssociatedToPoste(joueur.id, editingPosteId)"
              @change="togglePlayerPosteAssociation(joueur.id, editingPosteId!)"
            />
            {{ joueur.nom }}
          </label>
        </div>
      </div>

      <!-- Overlay pour fermer le panneau en cliquant à côté -->
      <div
        v-if="editMode && editingPosteId"
        class="panel-backdrop"
        @click="closePlayerEditPanel"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.map-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: #0f0f1a;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.floor-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.floor-selector button {
  padding: 0.5rem 1rem;
  border: 1px solid #444;
  background: #1a1a2e;
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.floor-selector button:hover {
  background: #2a2a4a;
}

.floor-selector button.active {
  background: #4a4a8a;
  border-color: #6a6aaa;
  color: #fff;
}

.map-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 100%;
}

.map-image {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 120px);
  width: auto;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  border-radius: 8px;
}

.overlay.edit-mode {
  pointer-events: all;
}

.zone {
  fill: rgba(100, 100, 100, 0.1);
  stroke: rgba(100, 100, 100, 0.3);
  stroke-width: 0.3;
  transition: all 0.3s;
}

.zone.active {
  fill: color-mix(in srgb, var(--zone-color) 20%, transparent);
  stroke: var(--zone-color);
  stroke-width: 0.5;
}

.zone.editable {
  cursor: move;
  transition: none;
}

.poste {
  fill: rgba(100, 100, 100, 0.1);
  stroke: rgba(100, 100, 100, 0.3);
  stroke-width: 0.3;
  transition: all 0.3s;
}

.poste.active {
  fill: color-mix(in srgb, var(--poste-color) 20%, transparent);
  stroke: var(--poste-color);
  stroke-width: 0.5;
}

.poste.editable {
  cursor: move;
  transition: none;
}

.point-handle {
  fill: #fff;
  stroke: #333;
  stroke-width: 0.3;
  cursor: move;
  opacity: 0.9;
}

.point-handle:hover {
  fill: #4ecdc4;
  opacity: 1;
}

.add-point-handle {
  fill: #4ecdc4;
  stroke: #fff;
  stroke-width: 0.2;
  cursor: pointer;
  opacity: 0.5;
}

.add-point-handle:hover {
  opacity: 1;
  r: 1;
}

.remove-polygon-btn {
  font-size: 3px;
  fill: #ff6b6b;
  text-anchor: middle;
  dominant-baseline: middle;
  cursor: pointer;
  opacity: 0.7;
  pointer-events: all;
}

.remove-polygon-btn:hover {
  fill: #ff4444;
  opacity: 1;
}

.poste.ghost {
  fill: var(--poste-color);
  stroke: var(--poste-color);
  stroke-width: 0.3;
  stroke-dasharray: 0.5, 0.3;
  opacity: 0.4;
}

.zone.ghost {
  fill: color-mix(in srgb, var(--zone-color) 10%, transparent);
  stroke: var(--zone-color);
  stroke-width: 0.3;
  stroke-dasharray: 1, 0.5;
  opacity: 0.4;
}

.poste-label {
  font-size: 2.5px;
  fill: #888;
  text-anchor: middle;
  transition: all 0.3s;
}

.poste-label.active {
  fill: #fff;
  font-weight: bold;
}

.poste-label.ghost {
  fill: var(--poste-color, #888);
  opacity: 0.5;
  font-style: italic;
}

/* Panneau d'édition des joueurs */
.panel-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
}

.player-edit-panel {
  position: fixed;
  z-index: 100;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  min-width: 150px;
  transform: translate(-50%, 10px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #333;
}

.panel-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.panel-close {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  line-height: 1;
}

.panel-close:hover {
  color: #fff;
}

.panel-content {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.player-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  color: #888;
  font-size: 0.85rem;
  transition: all 0.15s;
}

.player-checkbox:hover {
  background: #2a2a4a;
  color: #ccc;
}

.player-checkbox.checked {
  color: #fff;
  background: #2a2a4a;
}

.player-checkbox input {
  accent-color: #4ecdc4;
  cursor: pointer;
}
</style>

