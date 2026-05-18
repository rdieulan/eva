// Shared constants for map and game plan features

import type { GamePhase, PhaseNotes, PhaseMarkers, RolePhaseNotes, GamePlanNotes, Assignment, PhaseZones } from '../types/map.types';
import type { Zone } from '../types/zone.types';

// =============================================================================
// GAME PHASES
// =============================================================================

// All available phases (for iteration)
export const GAME_PHASES: GamePhase[] = ['START', 'ATTACK', 'DEFENSE'];

// Phase display names
export const PHASE_LABELS: Record<GamePhase, string> = {
  START: 'Start',
  ATTACK: 'Attaque',
  DEFENSE: 'Défense',
};

// =============================================================================
// MARKERS
// =============================================================================

// All available marker icons (for UI iteration)
export const MARKER_ICONS = [
  'player', 'position', 'eye', 'target', 'warning', 'star',
  'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
  'wait', 'move', 'group'
] as const;

// Default marker size
export const DEFAULT_MARKER_SIZE = 1;

// Available marker sizes with labels
export const MARKER_SIZES: { value: number; label: string }[] = [
  { value: 0.7, label: 'Petit' },
  { value: 1, label: 'Moyen' },
  { value: 1.5, label: 'Grand' },
];

// Default empty markers per phase
export const DEFAULT_PHASE_MARKERS: PhaseMarkers = {
  START: [],
  ATTACK: [],
  DEFENSE: [],
};

// =============================================================================
// GAME PLAN NOTES
// =============================================================================

// Default empty notes per phase
export const DEFAULT_PHASE_NOTES: PhaseNotes = {
  START: '',
  ATTACK: '',
  DEFENSE: '',
};

// Default empty role notes per phase
export const DEFAULT_ROLE_PHASE_NOTES: RolePhaseNotes = {
  START: {},
  ATTACK: {},
  DEFENSE: {},
};

// Default empty game plan notes
export const DEFAULT_GAME_PLAN_NOTES: GamePlanNotes = {
  general: '',
  phases: DEFAULT_PHASE_NOTES,
  roles: {},
  rolePhases: DEFAULT_ROLE_PHASE_NOTES,
};

// =============================================================================
// DEFAULT ASSIGNMENTS (ROLES)
// =============================================================================

// Default zone for a role
const createDefaultZone = (x: number, y: number, size: number = 15): Zone => ({
  x1: x - size,
  y1: y - size,
  x2: x + size,
  y2: y + size,
});

// Default zones for all phases (same position for simplicity)
const createDefaultPhaseZones = (x: number, y: number): PhaseZones => ({
  START: createDefaultZone(x, y),
  ATTACK: createDefaultZone(x, y),
  DEFENSE: createDefaultZone(x, y),
});

// Default 4 roles with positions in corners
export const DEFAULT_ASSIGNMENTS: Assignment[] = [
  { id: 1, name: 'Poste 1', x: 25, y: 25, zonesByPhase: createDefaultPhaseZones(25, 25), markersByPhase: DEFAULT_PHASE_MARKERS },
  { id: 2, name: 'Poste 2', x: 75, y: 25, zonesByPhase: createDefaultPhaseZones(75, 25), markersByPhase: DEFAULT_PHASE_MARKERS },
  { id: 3, name: 'Poste 3', x: 25, y: 75, zonesByPhase: createDefaultPhaseZones(25, 75), markersByPhase: DEFAULT_PHASE_MARKERS },
  { id: 4, name: 'Poste 4', x: 75, y: 75, zonesByPhase: createDefaultPhaseZones(75, 75), markersByPhase: DEFAULT_PHASE_MARKERS },
];

