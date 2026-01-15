<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MapConfig, Player, Point, Assignment, GamePhase, Zone, Marker, MarkerIcon } from '@/types';
import { getZoneForPhase, MARKER_ICONS, MARKER_SIZES } from '@shared/types';
import { assignmentColors } from '@/config/config';
import { getPlayerAssignments, getPlayerMainAssignment } from '@/services';
import { getZonePolygons } from '@/utils/zones';

// SVG paths for marker icons (inline to work in SVG context)
const MARKER_ICON_PATHS: Record<MarkerIcon, string> = {
  'player': 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  'position': 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
  'eye': 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  'target': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  'warning': 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  'star': 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  'arrow-up': 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
  'arrow-down': 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
  'arrow-left': 'M12 4l1.41 1.41L7.83 11H20v2H7.83l5.59 5.58L12 20l-8-8 8-8z',
  'arrow-right': 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z',
  'wait': 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  'move': 'M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z',
  'group': 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
};

// Get marker icon path
function getMarkerIconPath(icon: MarkerIcon): string {
  return MARKER_ICON_PATHS[icon] || MARKER_ICON_PATHS['position'];
}

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

// Check if an assignment is the main role for a player
function isMainAssignment(playerId: string, assignmentId: number): boolean {
  return getPlayerMainAssignment(props.map, playerId) === assignmentId;
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
      <div
        v-if="editMode && editingMarker && currentEditingMarker"
        class="marker-edit-panel"
        :style="{ left: markerEditPosition.x + 'px', top: markerEditPosition.y + 'px' }"
      >
        <div class="marker-panel-header">
          <span>Édition du marqueur</span>
          <button class="panel-close" @click="closeMarkerEditPanel">✕</button>
        </div>

        <div class="marker-panel-body">
          <!-- Icon selection -->
          <div class="marker-section">
            <label class="section-label">Icône</label>
            <div class="marker-icons-grid">
              <button
                v-for="icon in MARKER_ICONS"
                :key="icon"
                class="marker-icon-btn"
                :class="{ active: currentEditingMarker.icon === icon }"
                @click="updateMarkerIcon(editingMarker!.assignmentId, editingMarker!.markerId, icon)"
                :title="icon"
              >
                <svg viewBox="0 0 24 24" class="marker-icon-svg">
                  <path :d="getMarkerIconPath(icon)" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Size selection -->
          <div class="marker-section">
            <label class="section-label">Taille</label>
            <div class="marker-sizes-row">
              <button
                v-for="sizeOption in MARKER_SIZES"
                :key="sizeOption.value"
                class="marker-size-btn"
                :class="{ active: getMarkerSize(currentEditingMarker) === sizeOption.value }"
                @click="updateMarkerSize(editingMarker!.assignmentId, editingMarker!.markerId, sizeOption.value)"
              >
                {{ sizeOption.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Delete button -->
        <button
          class="marker-delete-btn"
          @click="removeMarker(editingMarker!.assignmentId, editingMarker!.markerId); closeMarkerEditPanel()"
        >
          🗑️ Supprimer
        </button>
      </div>

      <!-- Marker panel backdrop -->
      <div
        v-if="editMode && editingMarker"
        class="panel-backdrop marker-backdrop"
        @click="closeMarkerEditPanel"
      ></div>

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
          <div
            v-for="player in players"
            :key="player.id"
            class="player-row"
          >
            <label
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
            <button
              v-if="isPlayerAssociatedToAssignment(player.id, editingAssignmentId)"
              class="main-role-btn"
              :class="{ active: isMainAssignment(player.id, editingAssignmentId!) }"
              @click="toggleMainAssignment(player.id, editingAssignmentId!)"
              title="Définir comme rôle principal"
            >
              {{ isMainAssignment(player.id, editingAssignmentId!) ? '★' : '☆' }}
            </button>
          </div>
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


// Marker edit panel
.marker-edit-panel {
  position: fixed;
  z-index: 1001;
  background: $color-bg-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-sm;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  min-width: 180px;
  transform: translate(-50%, 10px);

  .marker-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-sm;
    padding-bottom: $spacing-xs;
    border-bottom: 1px solid $color-border;
    font-size: $font-size-sm;
    color: $color-text-primary;
  }

  .marker-panel-body {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
  }

  .marker-section {
    .section-label {
      display: block;
      font-size: $font-size-xs;
      color: $color-text-secondary;
      margin-bottom: $spacing-xs;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }

  .marker-icons-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }

  .marker-icon-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $color-bg-tertiary;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    cursor: pointer;
    transition: all 0.15s;
    padding: 0;

    &:hover {
      background: $color-bg-primary;
      border-color: $color-accent;
    }

    &.active {
      background: $color-accent;
      border-color: $color-accent;
    }

    .marker-icon-svg {
      width: 16px;
      height: 16px;
      fill: $color-text-primary;
    }
  }

  .marker-sizes-row {
    display: flex;
    gap: 4px;
  }

  .marker-size-btn {
    flex: 1;
    padding: $spacing-xs $spacing-sm;
    background: $color-bg-tertiary;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text-primary;
    font-size: $font-size-xs;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: $color-bg-primary;
      border-color: $color-accent;
    }

    &.active {
      background: $color-accent;
      border-color: $color-accent;
      color: #fff;
    }
  }

  .marker-delete-btn {
    width: 100%;
    margin-top: $spacing-sm;
    padding: $spacing-sm;
    background: rgba($color-danger, 0.1);
    border: 1px solid $color-danger;
    border-radius: $radius-sm;
    color: $color-danger;
    font-size: $font-size-sm;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: $color-danger;
      color: #fff;
    }
  }
}

.marker-backdrop {
  z-index: 1000;
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
  background: $color-bg-secondary;
  border: 1px solid #444;
  border-radius: $radius-md;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  min-width: 150px;
  transform: translate(-50%, 10px);

  @include mobile-lg {
    min-width: 130px;
    transform: translate(-50%, 5px);
  }

  @include mobile {
    min-width: 120px;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm 0.75rem;
  border-bottom: 1px solid $color-border;

  @include mobile-lg {
    padding: 0.4rem 0.6rem;
  }

  @include mobile {
    padding: 0.3rem $spacing-sm;
  }
}

.panel-title {
  font-weight: 600;
  font-size: 0.9rem;

  &.editable {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3rem;

    &:hover {
      opacity: 0.8;
    }
  }

  .edit-hint {
    font-size: 0.7rem;
    opacity: 0.5;
  }

  &.editable:hover .edit-hint {
    opacity: 1;
  }

  @include mobile-lg {
    font-size: 0.8rem;
  }

  @include mobile {
    font-size: 0.75rem;
  }
}

.name-edit-wrapper {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
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

  &:focus {
    border-color: #666;
  }
}

.name-save,
.name-cancel {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.1rem 0.3rem;
  font-size: 0.8rem;
  border-radius: 3px;
}

.name-save {
  color: $color-success;

  &:hover {
    background: rgba($color-success, 0.2);
  }
}

.name-cancel {
  color: $color-danger;

  &:hover {
    background: rgba($color-danger, 0.2);
  }
}

.panel-close {
  background: none;
  border: none;
  color: $color-text-secondary;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  line-height: 1;

  &:hover {
    color: #fff;
  }
}

.panel-content {
  padding: $spacing-sm;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  @include mobile-lg {
    padding: 0.4rem;
  }
}

.player-row {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.player-checkbox {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 0.4rem $spacing-sm;
  border-radius: $radius-sm;
  cursor: pointer;
  color: $color-text-secondary;
  font-size: 0.85rem;
  flex: 1;

  &:hover {
    background: $color-bg-tertiary;
    color: #ccc;
  }

  &.checked {
    color: #fff;
    background: $color-bg-tertiary;
  }

  input {
    accent-color: #4ecdc4;
    cursor: pointer;
  }

  @include mobile-lg {
    padding: 0.35rem 0.4rem;
    font-size: 0.8rem;
  }

  @include mobile {
    padding: 0.3rem;
    font-size: 0.75rem;
    gap: 0.35rem;
  }
}

.main-role-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.2rem;
  color: $color-text-secondary;
  opacity: 0.5;
  transition: all 0.15s;

  &:hover {
    opacity: 1;
    transform: scale(1.2);
    color: $color-star;
  }

  &.active {
    opacity: 1;
    color: $color-star;
  }
}
</style>

