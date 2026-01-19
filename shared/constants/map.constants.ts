// Shared constants for map and game plan features

import type { GamePhase, PhaseNotes, PhaseMarkers, RolePhaseNotes, GamePlanNotes } from '../types/map.types';

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
