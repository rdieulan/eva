<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MapConfig, Player, Point, Assignment } from '../types';
import { assignmentColors, getPlayerAssignments } from '../data/config';
import { getZonePolygons } from '../types';

const props = defineProps<{
  map: MapConfig;
  players: Player[];
  selectedPlayerId: string | null;
  activeAssignments: number[];
  editMode?: boolean;
}>();

const emit = defineEmits<{
  'update:map': [map: MapConfig];
  'player-assignment-changed': [playerId: string, assignmentId: number, associated: boolean];
}>();

// Image loading state
const imageLoaded = ref(false);
const imageRef = ref<HTMLImageElement | null>(null);
const imageRatio = ref(1);

// Current floor for multi-floor maps
const currentFloor = ref(0);

// Drag & drop state in edit mode
const dragging = ref<{
  type: 'assignment' | 'zone-move' | 'zone-point';
  assignmentId: number;
  polygonIndex?: number;
  pointIndex?: number;
} | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

// Player editing panel state
const editingAssignmentId = ref<number | null>(null);
const editPanelPosition = ref({ x: 0, y: 0 });
const editingAssignmentName_input = ref(false);
const tempAssignmentName = ref('');

// Reset floor when map changes
watch(() => props.map.id, () => {
  currentFloor.value = 0;
  imageLoaded.value = false;
});

// Image load handling
function onImageLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  imageRef.value = img;
  // Ratio to compensate for SVG deformation (width / height)
  imageRatio.value = img.naturalWidth / img.naturalHeight;
  imageLoaded.value = true;
}

// Number of floors in the map
const hasMultipleFloors = computed(() => props.map.images.length > 1);

// Current image
const currentImage = computed(() => props.map.images[currentFloor.value]);

// Reset imageLoaded when floor changes
watch(currentImage, () => {
  imageLoaded.value = false;
});

// Visible assignments on current floor
const visibleAssignments = computed(() => {
  if (!hasMultipleFloors.value) return props.map.assignments;
  return props.map.assignments.filter((p: Assignment) => p.floor === undefined || p.floor === currentFloor.value);
});

// Ghost assignments from other floors (for display when player is selected)
const ghostAssignments = computed(() => {
  if (!hasMultipleFloors.value || !props.selectedPlayerId) return [];
  return props.map.assignments
    .filter((p: Assignment) => p.floor !== undefined && p.floor !== currentFloor.value)
    .filter((p: Assignment) => props.activeAssignments.includes(p.id));
});

// Get assignment color
function getAssignmentColor(assignmentId: number): string {
  return assignmentColors[assignmentId] || '#888';
}

// Check if an assignment is active
function isAssignmentActive(assignmentId: number): boolean {
  return props.activeAssignments.includes(assignmentId);
}

// === Edit mode ===

// Convert mouse coordinates to SVG coordinates (0-100)
function getSvgCoords(event: MouseEvent): { x: number; y: number } {
  if (!svgRef.value) return { x: 0, y: 0 };

  const svg = svgRef.value;
  const rect = svg.getBoundingClientRect();

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

// Start drag on a position marker
function startDragAssignment(event: MouseEvent, assignmentId: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();
  dragging.value = { type: 'assignment', assignmentId };
}

// Start dragging a zone (move)
function startDragZone(event: MouseEvent, assignmentId: number, polygonIndex: number = 0) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();
  dragging.value = { type: 'zone-move', assignmentId, polygonIndex };
}

// Start dragging a zone point
function startDragZonePoint(event: MouseEvent, assignmentId: number, polygonIndex: number, pointIndex: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();
  dragging.value = { type: 'zone-point', assignmentId, polygonIndex, pointIndex };
}

// Add a point on a polygon edge
function addPointOnEdge(event: MouseEvent, assignmentId: number, polygonIndex: number, edgeIndex: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();

  const coords = getSvgCoords(event);
  const assignmentIndex = props.map.assignments.findIndex(p => p.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const targetAssignment = updatedMap.assignments[assignmentIndex];
  if (!targetAssignment) return;

  // Convert to multi-zone if necessary
  const polygons = getZonePolygons(targetAssignment.zone);
  const targetPolygon = polygons[polygonIndex];
  if (!targetPolygon) return;

  // Insert new point after edge index
  const newPoint: Point = {
    x: Math.round(coords.x * 10) / 10,
    y: Math.round(coords.y * 10) / 10
  };
  targetPolygon.splice(edgeIndex + 1, 0, newPoint);

  targetAssignment.zone = { polygons };
  emit('update:map', updatedMap);

  // Start dragging the new point
  dragging.value = { type: 'zone-point', assignmentId, polygonIndex, pointIndex: edgeIndex + 1 };
}

// Remove a point from polygon (minimum 3 points)
function removePoint(event: MouseEvent, assignmentId: number, polygonIndex: number, pointIndex: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();

  const assignmentIndex = props.map.assignments.findIndex(p => p.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const targetAssignment = updatedMap.assignments[assignmentIndex];
  if (!targetAssignment) return;

  const polygons = getZonePolygons(targetAssignment.zone);
  const targetPolygon = polygons[polygonIndex];
  if (!targetPolygon || targetPolygon.length <= 3) return; // Minimum 3 points for a polygon

  targetPolygon.splice(pointIndex, 1);
  targetAssignment.zone = { polygons };
  emit('update:map', updatedMap);
}

// Add a new zone piece (rectangle polygon by default)
function addZonePolygon(event: MouseEvent, assignmentId: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();

  const coords = getSvgCoords(event);
  const assignmentIndex = props.map.assignments.findIndex(p => p.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const targetAssignment = updatedMap.assignments[assignmentIndex];
  if (!targetAssignment) return;

  // Get existing polygons
  const polygons = getZonePolygons(targetAssignment.zone);

  // Create new rectangle centered on click
  const size = 5;
  const newPolygon: Point[] = [
    { x: Math.round((coords.x - size) * 10) / 10, y: Math.round((coords.y - size) * 10) / 10 },
    { x: Math.round((coords.x + size) * 10) / 10, y: Math.round((coords.y - size) * 10) / 10 },
    { x: Math.round((coords.x + size) * 10) / 10, y: Math.round((coords.y + size) * 10) / 10 },
    { x: Math.round((coords.x - size) * 10) / 10, y: Math.round((coords.y + size) * 10) / 10 },
  ];

  polygons.push(newPolygon);
  targetAssignment.zone = { polygons };
  emit('update:map', updatedMap);
}

// Remove an entire zone piece (if more than one polygon)
function removeZonePolygon(event: MouseEvent, assignmentId: number, polygonIndex: number) {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();

  const assignmentIndex = props.map.assignments.findIndex(p => p.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const targetAssignment = updatedMap.assignments[assignmentIndex];
  if (!targetAssignment) return;

  const polygons = getZonePolygons(targetAssignment.zone);
  if (polygons.length <= 1) return; // At least one polygon must remain

  polygons.splice(polygonIndex, 1);
  targetAssignment.zone = { polygons };
  emit('update:map', updatedMap);
}

// Handle mouse movement during drag
function handleMouseMove(event: MouseEvent) {
  if (!dragging.value || !props.editMode) return;

  const coords = getSvgCoords(event);
  const assignmentIndex = props.map.assignments.findIndex(p => p.id === dragging.value!.assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const targetAssignment = updatedMap.assignments[assignmentIndex];
  if (!targetAssignment) return;

  if (dragging.value.type === 'assignment') {
    // Move the marker
    targetAssignment.x = Math.round(coords.x * 10) / 10;
    targetAssignment.y = Math.round(coords.y * 10) / 10;
  } else if (dragging.value.type === 'zone-move') {
    // Move a specific polygon of the zone
    const polygons = getZonePolygons(targetAssignment.zone);
    const polygonIndex = dragging.value.polygonIndex ?? 0;
    const points = polygons[polygonIndex];
    if (!points) return;

    // Calculate current center
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    // Calculate offset
    const dx = coords.x - centerX;
    const dy = coords.y - centerY;

    // Apply offset to all polygon points
    polygons[polygonIndex] = points.map(p => ({
      x: Math.round((p.x + dx) * 10) / 10,
      y: Math.round((p.y + dy) * 10) / 10,
    }));

    targetAssignment.zone = { polygons };
  } else if (dragging.value.type === 'zone-point' && dragging.value.pointIndex !== undefined) {
    // Move a specific point
    const polygons = getZonePolygons(targetAssignment.zone);
    const polygonIndex = dragging.value.polygonIndex ?? 0;
    const points = polygons[polygonIndex];
    const pointIndex = dragging.value.pointIndex;

    if (points && pointIndex >= 0 && pointIndex < points.length) {
      points[pointIndex] = {
        x: Math.round(coords.x * 10) / 10,
        y: Math.round(coords.y * 10) / 10,
      };
      polygons[polygonIndex] = points;
      targetAssignment.zone = { polygons };
    }
  }

  emit('update:map', updatedMap);
}

// Stop dragging
function handleMouseUp() {
  dragging.value = null;
}

// Open player edit panel for an assignment
function openPlayerEditPanel(event: MouseEvent, assignmentId: number) {
  if (!props.editMode) return;

  // Don't open if we were dragging
  if (dragging.value) return;

  event.preventDefault();
  event.stopPropagation();

  editingAssignmentId.value = assignmentId;

  // Calculate panel position accounting for screen edges
  const panelHeight = 250; // Approximate panel height
  const panelWidth = 180; // Approximate panel width
  const margin = 20; // Margin from edges

  let x = event.clientX;
  let y = event.clientY;

  // Adjust if panel overflows bottom
  if (y + panelHeight + margin > window.innerHeight) {
    y = event.clientY - panelHeight - 10; // Show above click
  }

  // Adjust if panel overflows right
  if (x + panelWidth / 2 + margin > window.innerWidth) {
    x = window.innerWidth - panelWidth / 2 - margin;
  }

  // Adjust if panel overflows left
  if (x - panelWidth / 2 < margin) {
    x = panelWidth / 2 + margin;
  }

  // Adjust if panel overflows top
  if (y < margin) {
    y = margin;
  }

  editPanelPosition.value = { x, y };
}

// Close edit panel
function closePlayerEditPanel() {
  editingAssignmentId.value = null;
  editingAssignmentName_input.value = false;
}

// Start editing assignment name
function startEditingPosteName() {
  if (!editingAssignmentId.value) return;
  const poste = props.map.assignments.find(p => p.id === editingAssignmentId.value);
  tempAssignmentName.value = poste?.name || '';
  editingAssignmentName_input.value = true;
}

// Save new assignment name
function saveAssignmentName() {
  if (!editingAssignmentId.value || !tempAssignmentName.value.trim()) {
    editingAssignmentName_input.value = false;
    return;
  }

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const targetAssignment = updatedMap.assignments.find(p => p.id === editingAssignmentId.value);
  if (targetAssignment) {
    targetAssignment.name = tempAssignmentName.value.trim();
    emit('update:map', updatedMap);
  }
  editingAssignmentName_input.value = false;
}

// Cancel name editing
function cancelEditingAssignmentName() {
  editingAssignmentName_input.value = false;
}

// Check if a player is associated to an assignment
function isPlayerAssociatedToAssignment(playerId: string, assignmentId: number): boolean {
  const playerAssignments = getPlayerAssignments(props.map, playerId);
  return playerAssignments.includes(assignmentId);
}

// Toggle player-assignment association
function togglePlayerAssignmentAssociation(playerId: string, assignmentId: number) {
  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;

  // Find or create player assignment entry
  let playerAssignment = updatedMap.players.find(p => p.userId === playerId);
  if (!playerAssignment) {
    playerAssignment = { userId: playerId, assignmentIds: [] };
    updatedMap.players.push(playerAssignment);
  }

  const index = playerAssignment.assignmentIds.indexOf(assignmentId);

  let associated: boolean;
  if (index === -1) {
    playerAssignment.assignmentIds.push(assignmentId);
    associated = true;
  } else {
    playerAssignment.assignmentIds.splice(index, 1);
    associated = false;
  }

  emit('update:map', updatedMap);
  emit('player-assignment-changed', playerId, assignmentId, associated);
}

// Get assignment name being edited
const editingPosteName = computed(() => {
  if (!editingAssignmentId.value) return '';
  const poste = props.map.assignments.find(p => p.id === editingAssignmentId.value);
  return poste?.name || editingAssignmentId.value;
});

// Generate SVG path from polygon points
function getPolygonPathFromPoints(points: Point[]): string {
  if (points.length < 3) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
}

// Generate edge data for a polygon (to add points)
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
    <!-- Floor selector for multi-floor maps -->
    <div v-if="hasMultipleFloors" class="floor-selector">
      <button
        v-for="(image, index) in map.images"
        :key="image"
        :class="{ active: currentFloor === index }"
        @click="currentFloor = index"
      >
        {{ index === 0 ? 'RDC' : `Étage ${index}` }}
      </button>
    </div>

    <!-- Map image -->
    <div class="map-container">
      <img
        :src="currentImage"
        :alt="map.name"
        class="map-image"
        @load="onImageLoad"
      />

      <!-- SVG layer for overlays - same viewBox as coordinates in % -->
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
        <!-- Control zones for active assignments on current floor -->
        <g v-for="assignment in visibleAssignments.filter((p: Assignment) => isAssignmentActive(p.id))" :key="'zone-' + assignment.id">
          <!-- All polygons of the zone -->
          <g
            v-for="(polygon, polygonIndex) in getZonePolygons(assignment.zone)"
            :key="'polygon-' + polygonIndex"
          >
            <path
              :d="getPolygonPathFromPoints(polygon)"
              class="zone active"
              :class="{ editable: editMode }"
              :style="{ '--zone-color': getAssignmentColor(assignment.id) }"
              @mousedown="startDragZone($event, assignment.id, polygonIndex)"
              @contextmenu="openPlayerEditPanel($event, assignment.id)"
              @dblclick="editMode && addZonePolygon($event, assignment.id)"
            />
            <!-- Point handles in edit mode -->
            <template v-if="editMode">
              <!-- Polygon removal indicator (if more than one) -->
              <text
                v-if="getZonePolygons(assignment.zone).length > 1"
                :x="polygon.reduce((s: number, p: Point) => s + p.x, 0) / polygon.length"
                :y="polygon.reduce((s: number, p: Point) => s + p.y, 0) / polygon.length"
                class="remove-polygon-btn"
                @click="removeZonePolygon($event, assignment.id, polygonIndex)"
              >✕</text>
              <!-- Polygon points -->
              <circle
                v-for="(point, pointIndex) in polygon"
                :key="'point-' + pointIndex"
                :cx="point.x"
                :cy="point.y"
                r="1.2"
                class="point-handle"
                @mousedown="startDragZonePoint($event, assignment.id, polygonIndex, pointIndex)"
                @contextmenu.prevent="removePoint($event, assignment.id, polygonIndex, pointIndex)"
              />
              <!-- Buttons to add points on edges -->
              <circle
                v-for="(edge, edgeIndex) in getPolygonEdges(polygon)"
                :key="'add-point-' + edgeIndex"
                :cx="edge.midX"
                :cy="edge.midY"
                r="0.8"
                class="add-point-handle"
                @mousedown="addPointOnEdge($event, assignment.id, polygonIndex, edgeIndex)"
              />
            </template>
          </g>
        </g>

        <!-- Ghost zones (other floors) -->
        <g v-for="assignment in ghostAssignments" :key="'ghost-zone-' + assignment.id">
          <path
            v-for="(polygon, polygonIndex) in getZonePolygons(assignment.zone)"
            :key="'ghost-polygon-' + polygonIndex"
            :d="getPolygonPathFromPoints(polygon)"
            class="zone ghost"
            :style="{ '--zone-color': getAssignmentColor(assignment.id) }"
          />
        </g>


        <!-- Active assignment markers on current floor -->
        <g v-for="assignment in visibleAssignments.filter((p: Assignment) => isAssignmentActive(p.id))" :key="'marker-' + assignment.id">
          <ellipse
            :cx="assignment.x"
            :cy="assignment.y"
            :rx="1.5"
            :ry="1.5 * imageRatio"
            class="marker active"
            :class="{ editable: editMode }"
            :style="{ '--assignment-color': getAssignmentColor(assignment.id) }"
            @mousedown="startDragAssignment($event, assignment.id)"
            @contextmenu="openPlayerEditPanel($event, assignment.id)"
          />
        </g>

        <!-- Ghost markers (other floors) -->
        <g v-for="assignment in ghostAssignments" :key="'ghost-marker-' + assignment.id">
          <ellipse
            :cx="assignment.x"
            :cy="assignment.y"
            :rx="1.5"
            :ry="1.5 * imageRatio"
            class="marker ghost"
            :style="{ '--assignment-color': getAssignmentColor(assignment.id) }"
          />
        </g>
      </svg>

      <!-- Player edit panel -->
      <div
        v-if="editMode && editingAssignmentId"
        class="player-edit-panel"
        :style="{ left: editPanelPosition.x + 'px', top: editPanelPosition.y + 'px' }"
      >
        <div class="panel-header">
          <!-- Name display mode (clickable to edit) -->
          <span
            v-if="!editingAssignmentName_input"
            class="panel-title editable"
            :style="{ color: getAssignmentColor(editingAssignmentId) }"
            @click="startEditingPosteName"
            title="Click to edit name"
          >
            {{ editingPosteName }}
            <span class="edit-hint">✎</span>
          </span>
          <!-- Name edit mode -->
          <div v-else class="name-edit-wrapper">
            <input
              v-model="tempAssignmentName"
              class="name-input"
              :style="{ color: getAssignmentColor(editingAssignmentId) }"
              @keyup.enter="saveAssignmentName"
              @keyup.escape="cancelEditingAssignmentName"
              ref="nameInputRef"
              autofocus
            />
            <button class="name-save" @click="saveAssignmentName">✓</button>
            <button class="name-cancel" @click="cancelEditingAssignmentName">✕</button>
          </div>
          <button class="panel-close" @click="closePlayerEditPanel">✕</button>
        </div>
        <div class="panel-content">
          <label
            v-for="player in players"
            :key="player.id"
            class="player-checkbox"
            :class="{ checked: isPlayerAssociatedToAssignment(player.id, editingAssignmentId) }"
          >
            <input
              type="checkbox"
              :checked="isPlayerAssociatedToAssignment(player.id, editingAssignmentId)"
              @change="togglePlayerAssignmentAssociation(player.id, editingAssignmentId!)"
            />
            {{ player.name }}
          </label>
        </div>
      </div>

      <!-- Overlay to close panel when clicking outside -->
      <div
        v-if="editMode && editingAssignmentId"
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

.marker {
  fill: rgba(100, 100, 100, 0.1);
  stroke: rgba(100, 100, 100, 0.3);
  stroke-width: 0.3;
  transition: all 0.3s;
}

.assignment.active {
  fill: color-mix(in srgb, var(--assignment-color) 20%, transparent);
  stroke: var(--assignment-color);
  stroke-width: 0.5;
}

.assignment.editable {
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

.assignment.ghost {
  fill: var(--assignment-color);
  stroke: var(--assignment-color);
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

.marker-label {
  font-size: 2.5px;
  fill: #888;
  text-anchor: middle;
  transition: all 0.3s;
}

.marker-label.active {
  fill: #fff;
  font-weight: bold;
}

.marker-label.ghost {
  fill: var(--assignment-color, #888);
  opacity: 0.5;
  font-style: italic;
}

/* Player edit panel */
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

.panel-title.editable {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: opacity 0.2s;
}

.panel-title.editable:hover {
  opacity: 0.8;
}

.panel-title .edit-hint {
  font-size: 0.7rem;
  opacity: 0.5;
}

.panel-title.editable:hover .edit-hint {
  opacity: 1;
}

.name-edit-wrapper {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.name-input {
  background: #252540;
  border: 1px solid #444;
  border-radius: 3px;
  padding: 0.2rem 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  width: 100px;
  outline: none;
}

.name-input:focus {
  border-color: #666;
}

.name-save, .name-cancel {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.1rem 0.3rem;
  font-size: 0.8rem;
  border-radius: 3px;
  transition: all 0.15s;
}

.name-save {
  color: #4ade80;
}

.name-save:hover {
  background: rgba(74, 222, 128, 0.2);
}

.name-cancel {
  color: #ff6b6b;
}

.name-cancel:hover {
  background: rgba(255, 107, 107, 0.2);
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

