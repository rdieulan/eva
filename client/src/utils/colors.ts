// Color utility functions

import { ASSIGNMENT_COLORS, DEFAULT_ASSIGNMENT_COLOR } from '@/constants';

/**
 * Get color for an assignment ID (with fallback)
 */
export function getAssignmentColor(assignmentId: number): string {
  return ASSIGNMENT_COLORS[assignmentId] || DEFAULT_ASSIGNMENT_COLOR;
}

