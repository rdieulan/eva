// UI Constants

// Assignment colors (fixed for all maps, by assignment ID)
export const ASSIGNMENT_COLORS: Record<number, string> = {
  1: '#ff6b6b',
  2: '#4ecdc4',
  3: '#ffe66d',
  4: '#a66cff',
};

// Get color for an assignment ID (with fallback)
export function getAssignmentColor(assignmentId: number): string {
  return ASSIGNMENT_COLORS[assignmentId] || '#888888';
}

// Default fallback color
export const DEFAULT_COLOR = '#888888';

// Zone opacity settings
export const ZONE_OPACITY = {
  active: 0.3,
  inactive: 0.1,
  hover: 0.4,
};

// Marker sizes
export const MARKER_SIZE = {
  default: 12,
  selected: 16,
  editing: 14,
};

