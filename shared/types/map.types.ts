// Map and assignment types

import type { Zone } from './zone.types';
import type { PlayerAssignment } from './player.types';

// =============================================================================
// GAME PHASES
// =============================================================================

// Game phases for strategic planning
export type GamePhase = 'START' | 'ATTACK' | 'DEFENSE';

// All available phases (for iteration)
export const GAME_PHASES: GamePhase[] = ['START', 'ATTACK', 'DEFENSE'];

// Phase display names
export const PHASE_LABELS: Record<GamePhase, string> = {
  START: 'Start',
  ATTACK: 'Attaque',
  DEFENSE: 'Défense',
};

// =============================================================================
// ASSIGNMENTS & ZONES
// =============================================================================

// Zones per phase for an assignment
export type PhaseZones = Record<GamePhase, Zone>;

// =============================================================================
// MARKERS
// =============================================================================

// Available marker icons
export type MarkerIcon =
  | 'player'      // Player position (main marker)
  | 'position'    // Default position marker
  | 'eye'         // Watch/observe
  | 'target'      // Target/objective
  | 'warning'     // Warning/danger
  | 'star'        // Important point
  | 'arrow-up'    // Direction up
  | 'arrow-down'  // Direction down
  | 'arrow-left'  // Direction left
  | 'arrow-right' // Direction right
  | 'wait'        // Wait/hold position
  | 'move'        // Movement
  | 'group';      // Group/regroup

// All available marker icons (for UI iteration)
export const MARKER_ICONS: MarkerIcon[] = [
  'player', 'position', 'eye', 'target', 'warning', 'star',
  'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
  'wait', 'move', 'group'
];

// Single marker definition
export interface Marker {
  id: string;           // Unique marker ID
  x: number;            // X position (%)
  y: number;            // Y position (%)
  icon: MarkerIcon;     // Icon to display
  floor?: number;       // Floor for multi-floor maps
  size?: number;        // Size multiplier (default: 1)
}

// Default marker size
export const DEFAULT_MARKER_SIZE = 1;

// Available marker sizes with labels
export const MARKER_SIZES: { value: number; label: string }[] = [
  { value: 0.7, label: 'Petit' },
  { value: 1, label: 'Moyen' },
  { value: 1.5, label: 'Grand' },
];

// Markers per phase for an assignment
export type PhaseMarkers = Record<GamePhase, Marker[]>;

// Default empty markers per phase
export const DEFAULT_PHASE_MARKERS: PhaseMarkers = {
  START: [],
  ATTACK: [],
  DEFENSE: [],
};

// =============================================================================
// ASSIGNMENTS
// =============================================================================

export interface Assignment {
  id: number;
  name: string;
  x: number;
  y: number;
  zone?: Zone; // Legacy: single zone (will be migrated to zonesByPhase)
  zonesByPhase?: PhaseZones; // New: zones per phase
  markersByPhase?: PhaseMarkers; // Markers per phase
  floor?: number; // For multi-floor maps (0, 1, etc.)
}

// =============================================================================
// GAME PLAN NOTES
// =============================================================================

// Notes per phase
export type PhaseNotes = Record<GamePhase, string>;

// Notes per role (assignment id as key)
export type RoleNotes = Record<number, string>;

// Notes per role per phase
export type RolePhaseNotes = Record<GamePhase, RoleNotes>;

// Complete notes for a game plan
export interface GamePlanNotes {
  general: string; // General notes for the plan
  phases: PhaseNotes; // Notes per phase
  roles?: RoleNotes; // General notes per role (assignment id as key)
  rolePhases?: RolePhaseNotes; // Notes per role per phase
}

// Default empty notes
export const DEFAULT_PHASE_NOTES: PhaseNotes = {
  START: '',
  ATTACK: '',
  DEFENSE: '',
};

export const DEFAULT_ROLE_PHASE_NOTES: RolePhaseNotes = {
  START: {},
  ATTACK: {},
  DEFENSE: {},
};

export const DEFAULT_GAME_PLAN_NOTES: GamePlanNotes = {
  general: '',
  phases: DEFAULT_PHASE_NOTES,
  roles: {},
  rolePhases: DEFAULT_ROLE_PHASE_NOTES,
};

// =============================================================================
// GAME PLAN
// =============================================================================

// Full game plan data (for editing)
export interface GamePlan {
  id: string;
  name: string;
  mapId: string;
  assignments: Assignment[];
  players: PlayerAssignment[];
  notes: GamePlanNotes;
}

// Summary for list display
export interface GamePlanSummary {
  id: string;
  name: string;
}

// =============================================================================
// MAP CONFIG
// =============================================================================

export interface MapConfig {
  id: string;
  name: string;
  images: string[]; // Support for multiple images (floors)
  assignments: Assignment[];
  players: PlayerAssignment[];
  gamePlans?: GamePlanSummary[]; // List of available game plans
  notes?: GamePlanNotes; // Notes for current plan
}

export interface AppState {
  selectedMap: string | null;
  selectedPlayer: string | null;
  selectedFloor: number;
  selectedPhase: GamePhase; // Current phase being viewed/edited
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Get zone for a specific phase (with legacy fallback)
export function getZoneForPhase(assignment: Assignment, phase: GamePhase): Zone | undefined {
  if (assignment.zonesByPhase) {
    return assignment.zonesByPhase[phase];
  }
  // Legacy fallback: return same zone for all phases
  return assignment.zone;
}

// Check if assignment uses legacy zone format
export function isLegacyAssignment(assignment: Assignment): boolean {
  return !assignment.zonesByPhase && !!assignment.zone;
}

// Migrate legacy assignment to phase-based zones
export function migrateAssignmentToPhases(assignment: Assignment): Assignment {
  if (!isLegacyAssignment(assignment) || !assignment.zone) {
    return assignment;
  }

  return {
    ...assignment,
    zonesByPhase: {
      START: assignment.zone,
      ATTACK: assignment.zone,
      DEFENSE: assignment.zone,
    },
    zone: undefined, // Remove legacy zone
  };
}

// Migrate all assignments in a map config
export function migrateMapConfigToPhases(config: MapConfig): MapConfig {
  const hasLegacy = config.assignments.some(isLegacyAssignment);
  if (!hasLegacy) {
    return config;
  }

  return {
    ...config,
    assignments: config.assignments.map(migrateAssignmentToPhases),
  };
}

