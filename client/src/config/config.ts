// Application configuration constants

// Assignment colors (fixed for all maps, by assignment ID)
export const assignmentColors: Record<number, string> = {
  1: '#ff6b6b',
  2: '#4ecdc4',
  3: '#ffe66d',
  4: '#a66cff',
};

// Get color for an assignment ID (with fallback)
export function getAssignmentColor(assignmentId: number): string {
  return assignmentColors[assignmentId] || '#888888';
}


