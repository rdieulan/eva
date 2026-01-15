// Map utility functions
// Helper functions for map configurations and assignments

import type { Zone, Assignment, MapConfig, GamePhase } from '../types';

/**
 * Get zone for a specific phase (with legacy fallback)
 */
export function getZoneForPhase(assignment: Assignment, phase: GamePhase): Zone | undefined {
  if (assignment.zonesByPhase) {
    return assignment.zonesByPhase[phase];
  }
  // Legacy fallback: return same zone for all phases
  return assignment.zone;
}

/**
 * Check if assignment uses legacy zone format
 */
export function isLegacyAssignment(assignment: Assignment): boolean {
  return !assignment.zonesByPhase && !!assignment.zone;
}

/**
 * Migrate legacy assignment to phase-based zones
 */
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
    zone: undefined,
  };
}

/**
 * Migrate all assignments in a map config
 */
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

