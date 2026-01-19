// Map and assignment types

import type { Zone } from './zone.types';
import type { PlayerAssignment } from './player.types';

// =============================================================================
// GAME PHASES
// =============================================================================

// Game phases for strategic planning
export type GamePhase = 'START' | 'ATTACK' | 'DEFENSE';


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


// Single marker definition
export interface Marker {
  id: string;           // Unique marker ID
  x: number;            // X position (%)
  y: number;            // Y position (%)
  icon: MarkerIcon;     // Icon to display
  floor?: number;       // Floor for multi-floor maps
  size?: number;        // Size multiplier (default: 1)
}

// Markers per phase for an assignment
export type PhaseMarkers = Record<GamePhase, Marker[]>;


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

// Summary for list display (legacy, kept for compatibility)
export interface GamePlanSummary {
  id: string;
  name: string;
}

// Full game plan data (includes assignments, players, notes)
export interface GamePlanData {
  id: string;
  name: string;
  assignments: Assignment[];
  players: PlayerAssignment[];
  notes?: GamePlanNotes;
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
  gamePlans?: GamePlanData[]; // List of available game plans with full data
  notes?: GamePlanNotes; // Notes for current plan
}

export interface AppState {
  selectedMap: string | null;
  selectedPlayer: string | null;
  selectedFloor: number;
  selectedPhase: GamePhase; // Current phase being viewed/edited
}

