<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MapConfig, Player, Point, Assignment, GamePhase, Zone, Marker, MarkerIcon } from '@/types';
import { getZoneForPhase } from '@shared/types';
import { getAssignmentColor } from '@/utils/colors';
import { getMarkerIconPath } from '@/utils/markers';
import { getPlayerMainAssignment } from '@/services';
import { getZonePolygons } from '@/utils/zones';
import MarkerEditPanel from '@/components/planner/MarkerEditPanel.vue';
import PlayerEditPanel from '@/components/planner/PlayerEditPanel.vue';


const props = withDefaults(defineProps<{
  map: MapConfig;
  players: Player[];
  selectedPlayerId: string | null;
  activeAssignments: number[];
  editMode?: boolean;
  currentPhase?: GamePhase;
  drawerOpen?: boolean;
}>(), {
  editMode: false,
  currentPhase: 'START',
  drawerOpen: false,
});

const emit = defineEmits<{
  'update:map': [map: MapConfig];
  'player-assignment-changed': [playerId: string, assignmentId: number, associated: boolean];
  'main-assignment-changed': [playerId: string, assignmentId: number | null];
}>();

// Image loading state
const imageLoaded = ref(false);
const imageRef = ref<HTMLImageElement | null>(null);
const imageRatio = ref(1);

// Current floor for multi-floor maps
const currentFloor = ref(0);

// Drag & drop state in edit mode
const dragging = ref<{
  type: 'zone-move' | 'zone-point';
  assignmentId: number;
  polygonIndex?: number;
  pointIndex?: number;
} | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

// Player editing panel state
const editingAssignmentId = ref<number | null>(null);
const editPanelPosition = ref({ x: 0, y: 0 });

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

// Check if an assignment is active
function isAssignmentActive(assignmentId: number): boolean {
  return props.activeAssignments.includes(assignmentId);
}

// Get zone for current phase (with legacy fallback)
function getCurrentPhaseZone(assignment: Assignment): Zone | undefined {
  return getZoneForPhase(assignment, props.currentPhase);
}

// Get zone polygons for current phase
function getPhaseZonePolygons(assignment: Assignment): Point[][] {
  const zone = getCurrentPhaseZone(assignment);
  return getZonePolygons(zone);
}

// Update zone for current phase in an assignment
function updateAssignmentZoneForPhase(assignment: Assignment, polygons: Point[][]): void {
  const phase = props.currentPhase as GamePhase;

  // Initialize zonesByPhase if not present
  if (!assignment.zonesByPhase) {
    // Migrate from legacy zone
    const legacyZone = assignment.zone;
    assignment.zonesByPhase = {
      START: legacyZone ? JSON.parse(JSON.stringify(legacyZone)) : { polygons: [] },
      ATTACK: legacyZone ? JSON.parse(JSON.stringify(legacyZone)) : { polygons: [] },
      DEFENSE: legacyZone ? JSON.parse(JSON.stringify(legacyZone)) : { polygons: [] },
    };
    assignment.zone = undefined; // Remove legacy
  }

  // Update current phase zone
  assignment.zonesByPhase[phase] = { polygons };
}

// =============================================================================
// MARKERS
// =============================================================================

// Get markers for current phase
function getPhaseMarkers(assignment: Assignment): Marker[] {
  if (!assignment.markersByPhase) return [];
  return assignment.markersByPhase[props.currentPhase] || [];
}

// Get marker size (with default)
function getMarkerSize(marker: Marker): number {
  return marker.size ?? 1;
}


// Add a new marker for the current phase
function addMarker(assignmentId: number, x: number, y: number, icon: MarkerIcon = 'position', size: number = 1): void {
  const assignmentIndex = props.map.assignments.findIndex(a => a.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const assignment = updatedMap.assignments[assignmentIndex];
  if (!assignment) return;

  const phase = props.currentPhase;
  if (!assignment.markersByPhase) {
    assignment.markersByPhase = { START: [], ATTACK: [], DEFENSE: [] };
  }
  if (!assignment.markersByPhase[phase]) {
    assignment.markersByPhase[phase] = [];
  }

  // Generate unique ID
  const newMarker: Marker = {
    id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    icon,
    floor: currentFloor.value,
    size,
  };

  assignment.markersByPhase[phase].push(newMarker);
  emit('update:map', updatedMap);
}

// Remove a marker (any marker can be removed)
function removeMarker(assignmentId: number, markerId: string): void {
  const assignmentIndex = props.map.assignments.findIndex(a => a.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const assignment = updatedMap.assignments[assignmentIndex];
  if (!assignment) return;

  if (!assignment.markersByPhase) return;

  const phase = props.currentPhase;
  const markers = assignment.markersByPhase[phase];
  if (!markers) return;


  const markerIndex = markers.findIndex(m => m.id === markerId);
  if (markerIndex !== -1) {
    markers.splice(markerIndex, 1);
    emit('update:map', updatedMap);
  }
}

// Update marker position
function updateMarkerPosition(assignmentId: number, markerId: string, x: number, y: number): void {
  const assignmentIndex = props.map.assignments.findIndex(a => a.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const assignment = updatedMap.assignments[assignmentIndex];
  if (!assignment) return;

  if (!assignment.markersByPhase) return;

  const phase = props.currentPhase;
  const marker = assignment.markersByPhase[phase]?.find(m => m.id === markerId);
  if (marker) {
    marker.x = Math.round(x * 10) / 10;
    marker.y = Math.round(y * 10) / 10;
    emit('update:map', updatedMap);
  }
}

// Update marker icon
function updateMarkerIcon(assignmentId: number, markerId: string, icon: MarkerIcon): void {
  const assignmentIndex = props.map.assignments.findIndex(a => a.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const assignment = updatedMap.assignments[assignmentIndex];
  if (!assignment) return;

  if (!assignment.markersByPhase) return;

  const phase = props.currentPhase;
  const marker = assignment.markersByPhase[phase]?.find(m => m.id === markerId);
  if (marker) {
    marker.icon = icon;
    emit('update:map', updatedMap);
  }
}

// Update marker size
function updateMarkerSize(assignmentId: number, markerId: string, size: number): void {
  const assignmentIndex = props.map.assignments.findIndex(a => a.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const assignment = updatedMap.assignments[assignmentIndex];
  if (!assignment) return;

  if (!assignment.markersByPhase) return;

  const phase = props.currentPhase;
  const marker = assignment.markersByPhase[phase]?.find(m => m.id === markerId);
  if (marker) {
    marker.size = size;
    emit('update:map', updatedMap);
  }
}

// Marker editing state
const editingMarker = ref<{ assignmentId: number; markerId: string } | null>(null);
const markerEditPosition = ref({ x: 0, y: 0 });

// Open marker edit panel
function openMarkerEditPanel(event: MouseEvent, assignmentId: number, markerId: string): void {
  event.preventDefault();
  event.stopPropagation();
  editingMarker.value = { assignmentId, markerId };
  markerEditPosition.value = { x: event.clientX, y: event.clientY };
}

// Close marker edit panel
function closeMarkerEditPanel(): void {
  editingMarker.value = null;
}

// Get current editing marker
const currentEditingMarker = computed(() => {
  if (!editingMarker.value) return null;
  const assignment = props.map.assignments.find(a => a.id === editingMarker.value?.assignmentId);
  if (!assignment?.markersByPhase) return null;
  return assignment.markersByPhase[props.currentPhase]?.find(m => m.id === editingMarker.value?.markerId);
});

// Marker drag state
const draggingMarker = ref<{ assignmentId: number; markerId: string } | null>(null);

// Start dragging a marker
function startDragMarker(event: MouseEvent, assignmentId: number, markerId: string): void {
  if (!props.editMode) return;
  event.preventDefault();
  event.stopPropagation();
  draggingMarker.value = { assignmentId, markerId };
}

// =============================================================================
// EDIT MODE
// =============================================================================

// Convert mouse coordinates to SVG coordinates (0-100)
function getSvgCoords(event: MouseEvent): { x: number; y: number } {
  if (!svgRef.value) return { x: 0, y: 0 };

  const svg = svgRef.value;
  const rect = svg.getBoundingClientRect();

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
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

  // Get polygons for current phase
  const polygons = getPhaseZonePolygons(targetAssignment);
  const targetPolygon = polygons[polygonIndex];
  if (!targetPolygon) return;

  // Insert new point after edge index
  const newPoint: Point = {
    x: Math.round(coords.x * 10) / 10,
    y: Math.round(coords.y * 10) / 10
  };
  targetPolygon.splice(edgeIndex + 1, 0, newPoint);

  updateAssignmentZoneForPhase(targetAssignment, polygons);
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

  const polygons = getPhaseZonePolygons(targetAssignment);
  const targetPolygon = polygons[polygonIndex];
  if (!targetPolygon || targetPolygon.length <= 3) return; // Minimum 3 points for a polygon

  targetPolygon.splice(pointIndex, 1);
  updateAssignmentZoneForPhase(targetAssignment, polygons);
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

  // Get existing polygons for current phase
  const polygons = getPhaseZonePolygons(targetAssignment);

  // Create new rectangle centered on click
  const size = 5;
  const newPolygon: Point[] = [
    { x: Math.round((coords.x - size) * 10) / 10, y: Math.round((coords.y - size) * 10) / 10 },
    { x: Math.round((coords.x + size) * 10) / 10, y: Math.round((coords.y - size) * 10) / 10 },
    { x: Math.round((coords.x + size) * 10) / 10, y: Math.round((coords.y + size) * 10) / 10 },
    { x: Math.round((coords.x - size) * 10) / 10, y: Math.round((coords.y + size) * 10) / 10 },
  ];

  polygons.push(newPolygon);
  updateAssignmentZoneForPhase(targetAssignment, polygons);
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

  const polygons = getPhaseZonePolygons(targetAssignment);
  if (polygons.length <= 1) return; // At least one polygon must remain

  polygons.splice(polygonIndex, 1);
  updateAssignmentZoneForPhase(targetAssignment, polygons);
  emit('update:map', updatedMap);
}

// Handle mouse movement during drag
function handleMouseMove(event: MouseEvent) {
  // Handle marker dragging
  if (draggingMarker.value && props.editMode) {
    const coords = getSvgCoords(event);
    updateMarkerPosition(
      draggingMarker.value.assignmentId,
      draggingMarker.value.markerId,
      coords.x,
      coords.y
    );
    return;
  }

  if (!dragging.value || !props.editMode) return;

  const coords = getSvgCoords(event);
  const assignmentIndex = props.map.assignments.findIndex(p => p.id === dragging.value!.assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const targetAssignment = updatedMap.assignments[assignmentIndex];
  if (!targetAssignment) return;

  if (dragging.value.type === 'zone-move') {
    // Move a specific polygon of the zone for current phase
    const polygons = getPhaseZonePolygons(targetAssignment);
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

    updateAssignmentZoneForPhase(targetAssignment, polygons);
  } else if (dragging.value.type === 'zone-point' && dragging.value.pointIndex !== undefined) {
    // Move a specific point for current phase
    const polygons = getPhaseZonePolygons(targetAssignment);
    const polygonIndex = dragging.value.polygonIndex ?? 0;
    const points = polygons[polygonIndex];
    const pointIndex = dragging.value.pointIndex;

    if (points && pointIndex >= 0 && pointIndex < points.length) {
      points[pointIndex] = {
        x: Math.round(coords.x * 10) / 10,
        y: Math.round(coords.y * 10) / 10,
      };
      polygons[polygonIndex] = points;
      updateAssignmentZoneForPhase(targetAssignment, polygons);
    }
  }

  emit('update:map', updatedMap);
}

// Stop dragging
function handleMouseUp() {
  dragging.value = null;
  draggingMarker.value = null;
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
}

// Handle assignment name update from panel
function handleAssignmentNameUpdate(newName: string) {
  if (!editingAssignmentId.value) return;
  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const targetAssignment = updatedMap.assignments.find(p => p.id === editingAssignmentId.value);
  if (targetAssignment) {
    targetAssignment.name = newName;
    emit('update:map', updatedMap);
  }
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


// Toggle main assignment for a player
function toggleMainAssignment(playerId: string, assignmentId: number) {
  const currentMain = getPlayerMainAssignment(props.map, playerId);
  // If already main, unset it; otherwise set it
  const newMain = currentMain === assignmentId ? null : assignmentId;
  emit('main-assignment-changed', playerId, newMain);
}

// Get assignment name being edited
const editingPosteName = computed(() => {
  if (!editingAssignmentId.value) return '';
  const poste = props.map.assignments.find(p => p.id === editingAssignmentId.value);
  return poste?.name || String(editingAssignmentId.value);
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

// =============================================================================
// TOOLBAR ACTIONS (exposed to parent)
// =============================================================================

// Add marker from toolbar button (places near player marker or center)
function addMarkerFromToolbar(assignmentId: number): void {
  const assignment = props.map.assignments.find(a => a.id === assignmentId);
  if (!assignment) return;

  // Find the player marker position or use assignment legacy position
  const markers = getPhaseMarkers(assignment);
  const playerMarker = markers.find(m => m.icon === 'player');
  const baseX = playerMarker?.x ?? assignment.x;
  const baseY = playerMarker?.y ?? assignment.y;

  // Add new marker offset from base position
  addMarker(assignmentId, baseX + 5, baseY, 'position');
}

// Add zone from toolbar button (places near center or existing zone)
function addZoneFromToolbar(assignmentId: number): void {
  const assignmentIndex = props.map.assignments.findIndex(a => a.id === assignmentId);
  if (assignmentIndex === -1) return;

  const updatedMap = JSON.parse(JSON.stringify(props.map)) as MapConfig;
  const assignment = updatedMap.assignments[assignmentIndex];
  if (!assignment) return;

  // Get existing polygons for current phase
  const existingPolygons = getPhaseZonePolygons(assignment);

  // Calculate position for new zone
  let centerX = 50;
  let centerY = 50;

  if (existingPolygons.length > 0 && existingPolygons[0] && existingPolygons[0].length > 0) {
    // Place near existing zone
    const firstPolygon = existingPolygons[0];
    centerX = firstPolygon.reduce((sum, p) => sum + p.x, 0) / firstPolygon.length + 10;
    centerY = firstPolygon.reduce((sum, p) => sum + p.y, 0) / firstPolygon.length;
  } else {
    // Place near player marker or assignment position
    const markers = getPhaseMarkers(assignment);
    const playerMarker = markers.find(m => m.icon === 'player');
    centerX = playerMarker?.x ?? assignment.x;
    centerY = playerMarker?.y ?? assignment.y;
  }

  // Create new rectangle
  const size = 5;
  const newPolygon: Point[] = [
    { x: Math.round((centerX - size) * 10) / 10, y: Math.round((centerY - size) * 10) / 10 },
    { x: Math.round((centerX + size) * 10) / 10, y: Math.round((centerY - size) * 10) / 10 },
    { x: Math.round((centerX + size) * 10) / 10, y: Math.round((centerY + size) * 10) / 10 },
    { x: Math.round((centerX - size) * 10) / 10, y: Math.round((centerY + size) * 10) / 10 },
  ];

  // Get existing polygons and add new one
  const polygons = getPhaseZonePolygons(assignment);
  polygons.push(newPolygon);
  updateAssignmentZoneForPhase(assignment, polygons);
  emit('update:map', updatedMap);
}

// Expose methods for parent component
defineExpose({
  addMarkerFromToolbar,
  addZoneFromToolbar,
});
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
    <div class="map-container" :class="{ 'drawer-open': drawerOpen }">
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
          <!-- All polygons of the zone for current phase -->
          <g
            v-for="(polygon, polygonIndex) in getPhaseZonePolygons(assignment)"
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
                v-if="getPhaseZonePolygons(assignment).length > 1"
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
            v-for="(polygon, polygonIndex) in getPhaseZonePolygons(assignment)"
            :key="'ghost-polygon-' + polygonIndex"
            :d="getPolygonPathFromPoints(polygon)"
            class="zone ghost"
            :style="{ '--zone-color': getAssignmentColor(assignment.id) }"
          />
        </g>


        <!-- Active assignment markers on current floor -->
        <g v-for="assignment in visibleAssignments.filter((p: Assignment) => isAssignmentActive(p.id))" :key="'marker-' + assignment.id">
          <!-- Phase-specific markers -->
          <g
            v-for="marker in getPhaseMarkers(assignment)"
            :key="marker.id"
            class="phase-marker"
            :class="{ editable: editMode }"
            :style="{ '--marker-color': getAssignmentColor(assignment.id) }"
            :transform="`translate(${marker.x}, ${marker.y}) scale(1, ${imageRatio})`"
            @mousedown="startDragMarker($event, assignment.id, marker.id)"
            @contextmenu.prevent="editMode ? openMarkerEditPanel($event, assignment.id, marker.id) : openPlayerEditPanel($event, assignment.id)"
            @dblclick="editMode && removeMarker(assignment.id, marker.id)"
          >
            <!-- Marker circle background (in scaled space, so appears round) -->
            <circle
              cx="0"
              cy="0"
              :r="2 * getMarkerSize(marker)"
              class="marker-bg"
            />
            <!-- Marker icon (scaled path) -->
            <g :transform="`translate(${-1.2 * getMarkerSize(marker)}, ${-1.2 * getMarkerSize(marker)}) scale(${0.1 * getMarkerSize(marker)})`">
              <path
                :d="getMarkerIconPath(marker.icon)"
                class="marker-icon-path"
              />
            </g>
          </g>
        </g>

        <!-- Ghost markers (other floors) -->
        <g v-for="assignment in ghostAssignments" :key="'ghost-marker-' + assignment.id">
          <g
            v-for="marker in getPhaseMarkers(assignment)"
            :key="'ghost-' + marker.id"
            class="phase-marker ghost"
            :style="{ '--marker-color': getAssignmentColor(assignment.id) }"
            :transform="`translate(${marker.x}, ${marker.y}) scale(1, ${imageRatio})`"
          >
            <circle
              cx="0"
              cy="0"
              :r="2 * getMarkerSize(marker)"
              class="marker-bg"
            />
          </g>
        </g>
      </svg>

      <!-- Marker edit panel -->
      <MarkerEditPanel
        v-if="editMode && editingMarker && currentEditingMarker"
        :marker="currentEditingMarker"
        :position="markerEditPosition"
        @update:icon="(icon) => updateMarkerIcon(editingMarker!.assignmentId, editingMarker!.markerId, icon)"
        @update:size="(size) => updateMarkerSize(editingMarker!.assignmentId, editingMarker!.markerId, size)"
        @delete="removeMarker(editingMarker!.assignmentId, editingMarker!.markerId); closeMarkerEditPanel()"
        @close="closeMarkerEditPanel"
      />

      <!-- Player edit panel -->
      <PlayerEditPanel
        v-if="editMode && editingAssignmentId"
        :assignment-id="editingAssignmentId"
        :assignment-name="editingPosteName"
        :assignment-color="getAssignmentColor(editingAssignmentId)"
        :position="editPanelPosition"
        :players="players"
        :map="map"
        @toggle-player="(playerId) => togglePlayerAssignmentAssociation(playerId, editingAssignmentId!)"
        @toggle-main="(playerId) => toggleMainAssignment(playerId, editingAssignmentId!)"
        @update-name="handleAssignmentNameUpdate"
        @close="closePlayerEditPanel"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.map-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-sm;
  background: $color-bg-primary;
  overflow: hidden;
  min-width: 0;
  min-height: 0;

  @include mobile-lg {
    padding: $spacing-sm;
  }

  @include mobile {
    padding: 0.35rem;
  }
}

.floor-selector {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
  flex-shrink: 0;

  @include tablet {
    gap: 0.35rem;
  }

  @include mobile-lg {
    gap: $spacing-xs;
    margin-bottom: $spacing-sm;
  }

  button {
    padding: $spacing-sm $spacing-md;
    border: 1px solid #444;
    background: $color-bg-secondary;
    color: #ccc;
    border-radius: $radius-sm;
    cursor: pointer;

    &:hover {
      background: $color-bg-tertiary;
    }

    &.active {
      background: #4a4a8a;
      border-color: #6a6aaa;
      color: #fff;
    }

    @include tablet {
      padding: 0.35rem 0.6rem;
      font-size: 0.75rem;
    }

    @include mobile-lg {
      padding: 0.3rem $spacing-sm;
      font-size: 0.7rem;
      border-radius: $radius-sm;
    }

    @include mobile {
      padding: $spacing-xs 0.4rem;
      font-size: 0.65rem;
    }
  }
}

.map-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 100%;
  transition: transform 0.25s ease;

  &.drawer-open {
    transform: translateX(-160px);
  }
}

.map-image {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 120px);
  width: auto;
  height: auto;
  border-radius: $radius-md;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  border-radius: $radius-md;

  &.edit-mode {
    pointer-events: all;
  }
}

.zone {
  fill: rgba(100, 100, 100, 0.1);
  stroke: rgba(100, 100, 100, 0.3);
  stroke-width: 0.3;

  &.active {
    fill: color-mix(in srgb, var(--zone-color) 20%, transparent);
    stroke: var(--zone-color);
    stroke-width: 0.5;
  }

  &.editable {
    cursor: move;
  }

  &.ghost {
    fill: color-mix(in srgb, var(--zone-color) 10%, transparent);
    stroke: var(--zone-color);
    stroke-width: 0.3;
    stroke-dasharray: 1, 0.5;
    opacity: 0.4;
  }
}

.marker {
  fill: rgba(100, 100, 100, 0.1);
  stroke: rgba(100, 100, 100, 0.3);
  stroke-width: 0.3;

  &.active {
    fill: color-mix(in srgb, var(--assignment-color) 60%, transparent);
    stroke: var(--assignment-color);
    stroke-width: 0.5;
  }

  &.editable {
    cursor: move;
  }

  &.ghost {
    fill: var(--assignment-color);
    stroke: var(--assignment-color);
    stroke-width: 0.3;
    stroke-dasharray: 0.5, 0.3;
    opacity: 0.4;
  }
}

// Phase-specific markers
.phase-marker {
  cursor: default;

  &.editable {
    cursor: move;
  }

  .marker-bg {
    fill: var(--marker-color);
    stroke: #fff;
    stroke-width: 0.3;
    opacity: 0.9;
  }

  .marker-icon-path {
    fill: #fff;
    pointer-events: none;
  }

  &:hover .marker-bg {
    opacity: 1;
    stroke-width: 0.5;
  }

  // Ghost markers
  &.ghost {
    .marker-bg {
      opacity: 0.4;
      stroke-dasharray: 0.5, 0.3;
    }
  }
}


.point-handle {
  fill: #fff;
  stroke: $color-border;
  stroke-width: 0.3;
  cursor: move;
  opacity: 0.9;

  &:hover {
    fill: #4ecdc4;
    opacity: 1;
  }
}

.add-point-handle {
  fill: #4ecdc4;
  stroke: #fff;
  stroke-width: 0.2;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
  }
}

.remove-polygon-btn {
  font-size: 3px;
  fill: $color-danger;
  text-anchor: middle;
  dominant-baseline: middle;
  cursor: pointer;
  opacity: 0.7;
  pointer-events: all;

  &:hover {
    fill: #ff4444;
    opacity: 1;
  }
}

.marker-label {
  font-size: 2.5px;
  fill: $color-text-secondary;
  text-anchor: middle;

  &.active {
    fill: #fff;
    font-weight: bold;
  }

  &.ghost {
    fill: var(--assignment-color, $color-text-secondary);
    opacity: 0.5;
    font-style: italic;
  }

  @include tablet {
    font-size: 2px;
  }

  @include mobile-lg {
    font-size: 1.8px;
  }

  @include mobile {
    font-size: 1.5px;
  }
}

</style>

