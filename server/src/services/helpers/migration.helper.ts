// Game plan migration helpers

export interface Assignment {
  id: number;
  name: string;
  x: number;
  y: number;
  zone?: object;
  zonesByPhase?: Record<string, object>;
  floor?: number;
}

/**
 * Migrate legacy zone format to phase-based zones
 * Converts single zone to START/ATTACK/DEFENSE phases
 */
export function migrateAssignmentsToPhases(assignments: Assignment[]): Assignment[] {
  return assignments.map(assignment => {
    // Already migrated
    if (assignment.zonesByPhase) {
      return assignment;
    }
    // Has legacy zone - migrate it
    if (assignment.zone) {
      return {
        ...assignment,
        zonesByPhase: {
          START: JSON.parse(JSON.stringify(assignment.zone)),
          ATTACK: JSON.parse(JSON.stringify(assignment.zone)),
          DEFENSE: JSON.parse(JSON.stringify(assignment.zone)),
        },
        zone: undefined,
      };
    }
    // No zone at all
    return assignment;
  });
}
