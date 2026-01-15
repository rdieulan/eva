import { describe, it, expect } from 'vitest';
import {
  isZonePolygon,
  isZoneMulti,
  isZoneRect,
  rectToPolygon,
  getZonePolygons,
  getZonePoints,
  getPolygonPath,
  getPolygonCentroid,
} from '@/utils/zones';
import {
  GAME_PHASES,
  PHASE_LABELS,
  MARKER_ICONS,
  MARKER_SIZES,
  DEFAULT_MARKER_SIZE,
  DEFAULT_PHASE_MARKERS,
  getZoneForPhase,
  isLegacyAssignment,
  migrateAssignmentToPhases,
  migrateMapConfigToPhases,
} from '@shared/types';
import type { ZoneRect, ZonePolygon, ZoneMulti, Point, Assignment, Marker, GamePhase, MapConfig } from '@shared/types';

// =============================================================================
// ZONE UTILITIES TESTS (real code from @/utils/zones)
// =============================================================================

describe('Zone Type Guards (real code)', () => {
  describe('isZonePolygon', () => {
    it('should return true for a polygon zone', () => {
      const zone: ZonePolygon = {
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
      };
      expect(isZonePolygon(zone)).toBe(true);
    });

    it('should return false for a rect zone', () => {
      const zone: ZoneRect = { x1: 0, y1: 0, x2: 10, y2: 10 };
      expect(isZonePolygon(zone)).toBe(false);
    });

    it('should return false for a multi zone', () => {
      const zone: ZoneMulti = {
        polygons: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]]
      };
      expect(isZonePolygon(zone)).toBe(false);
    });
  });

  describe('isZoneMulti', () => {
    it('should return true for a multi zone', () => {
      const zone: ZoneMulti = {
        polygons: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]]
      };
      expect(isZoneMulti(zone)).toBe(true);
    });

    it('should return false for a rect zone', () => {
      const zone: ZoneRect = { x1: 0, y1: 0, x2: 10, y2: 10 };
      expect(isZoneMulti(zone)).toBe(false);
    });
  });

  describe('isZoneRect', () => {
    it('should return true for a rect zone', () => {
      const zone: ZoneRect = { x1: 0, y1: 0, x2: 10, y2: 10 };
      expect(isZoneRect(zone)).toBe(true);
    });

    it('should return false for a polygon zone', () => {
      const zone: ZonePolygon = {
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
      };
      expect(isZoneRect(zone)).toBe(false);
    });
  });
});

describe('Zone Conversion (real code)', () => {
  describe('rectToPolygon', () => {
    it('should convert a rectangle to 4 corner points', () => {
      const rect: ZoneRect = { x1: 10, y1: 20, x2: 30, y2: 40 };
      const polygon = rectToPolygon(rect);

      expect(polygon.points).toHaveLength(4);
      expect(polygon.points[0]).toEqual({ x: 10, y: 20 });
      expect(polygon.points[1]).toEqual({ x: 30, y: 20 });
      expect(polygon.points[2]).toEqual({ x: 30, y: 40 });
      expect(polygon.points[3]).toEqual({ x: 10, y: 40 });
    });
  });

  describe('getZonePolygons', () => {
    it('should return polygons array from multi zone', () => {
      const points1: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
      const points2: Point[] = [{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }];
      const zone: ZoneMulti = { polygons: [points1, points2] };

      const result = getZonePolygons(zone);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(points1);
      expect(result[1]).toBe(points2);
    });

    it('should wrap polygon zone points in array', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
      const zone: ZonePolygon = { points };

      const result = getZonePolygons(zone);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(points);
    });

    it('should convert rect zone to polygon array', () => {
      const zone: ZoneRect = { x1: 0, y1: 0, x2: 100, y2: 100 };

      const result = getZonePolygons(zone);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(4);
    });

    it('should return empty array for undefined zone', () => {
      const result = getZonePolygons(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('getZonePoints', () => {
    it('should return first polygon points for multi zone', () => {
      const points1: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
      const points2: Point[] = [{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 30 }];
      const zone: ZoneMulti = { polygons: [points1, points2] };

      const result = getZonePoints(zone);

      expect(result).toBe(points1);
    });

    it('should return points for polygon zone', () => {
      const points: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
      const zone: ZonePolygon = { points };

      const result = getZonePoints(zone);

      expect(result).toBe(points);
    });

    it('should return empty array for empty multi zone', () => {
      const zone: ZoneMulti = { polygons: [] };

      const result = getZonePoints(zone);

      expect(result).toEqual([]);
    });
  });
});

// =============================================================================
// GAME PHASES & MARKERS CONSTANTS (real code from @shared/types)
// =============================================================================

describe('Game Phases Constants (real code)', () => {
  it('should have exactly 3 phases', () => {
    expect(GAME_PHASES).toHaveLength(3);
    expect(GAME_PHASES).toEqual(['START', 'ATTACK', 'DEFENSE']);
  });

  it('should have labels for all phases', () => {
    GAME_PHASES.forEach(phase => {
      expect(PHASE_LABELS[phase]).toBeDefined();
      expect(typeof PHASE_LABELS[phase]).toBe('string');
    });
  });
});

describe('Marker Constants (real code)', () => {
  it('should have 13 marker icons', () => {
    expect(MARKER_ICONS).toHaveLength(13);
    expect(MARKER_ICONS).toContain('player');
    expect(MARKER_ICONS).toContain('target');
    expect(MARKER_ICONS).toContain('warning');
  });

  it('should have 3 marker sizes with labels', () => {
    expect(MARKER_SIZES).toHaveLength(3);
    expect(MARKER_SIZES[0]).toEqual({ value: 0.7, label: 'Petit' });
    expect(MARKER_SIZES[1]).toEqual({ value: 1, label: 'Moyen' });
    expect(MARKER_SIZES[2]).toEqual({ value: 1.5, label: 'Grand' });
  });

  it('should have default marker size of 1', () => {
    expect(DEFAULT_MARKER_SIZE).toBe(1);
  });

  it('should have empty default phase markers', () => {
    expect(DEFAULT_PHASE_MARKERS.START).toEqual([]);
    expect(DEFAULT_PHASE_MARKERS.ATTACK).toEqual([]);
    expect(DEFAULT_PHASE_MARKERS.DEFENSE).toEqual([]);
  });
});

// =============================================================================
// ZONE FOR PHASE (real code from @shared/types)
// =============================================================================

describe('getZoneForPhase (real code)', () => {
  it('should return zone from zonesByPhase when available', () => {
    const assignment: Assignment = {
      id: 1,
      name: 'Test',
      x: 50,
      y: 50,
      zonesByPhase: {
        START: { polygons: [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]] },
        ATTACK: { polygons: [[{ x: 30, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 40 }]] },
        DEFENSE: { polygons: [[{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 60, y: 60 }]] },
      },
    };

    const startZone = getZoneForPhase(assignment, 'START');
    const attackZone = getZoneForPhase(assignment, 'ATTACK');

    expect(startZone).toBe(assignment.zonesByPhase?.START);
    expect(attackZone).toBe(assignment.zonesByPhase?.ATTACK);
  });

  it('should return legacy zone when zonesByPhase is not available', () => {
    const legacyZone = { x1: 10, y1: 10, x2: 50, y2: 50 };
    const assignment: Assignment = {
      id: 1,
      name: 'Legacy',
      x: 50,
      y: 50,
      zone: legacyZone,
    };

    const result = getZoneForPhase(assignment, 'START');
    expect(result).toBe(legacyZone);
  });

  it('should return undefined when no zone data exists', () => {
    const assignment: Assignment = {
      id: 1,
      name: 'No Zone',
      x: 50,
      y: 50,
    };

    const result = getZoneForPhase(assignment, 'START');
    expect(result).toBeUndefined();
  });
});

// =============================================================================
// LEGACY ASSIGNMENT DETECTION (real code from @shared/types)
// =============================================================================

describe('isLegacyAssignment (real code)', () => {
  it('should return true for assignment with only legacy zone', () => {
    const assignment: Assignment = {
      id: 1,
      name: 'Legacy',
      x: 50,
      y: 50,
      zone: { x1: 10, y1: 10, x2: 50, y2: 50 },
    };

    expect(isLegacyAssignment(assignment)).toBe(true);
  });

  it('should return false for assignment with zonesByPhase', () => {
    const assignment: Assignment = {
      id: 1,
      name: 'Modern',
      x: 50,
      y: 50,
      zonesByPhase: {
        START: { polygons: [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]] },
        ATTACK: { polygons: [[{ x: 30, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 40 }]] },
        DEFENSE: { polygons: [[{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 60, y: 60 }]] },
      },
    };

    expect(isLegacyAssignment(assignment)).toBe(false);
  });

  it('should return false for assignment with no zones', () => {
    const assignment: Assignment = {
      id: 1,
      name: 'No Zone',
      x: 50,
      y: 50,
    };

    expect(isLegacyAssignment(assignment)).toBe(false);
  });
});

// =============================================================================
// TYPE STRUCTURE VALIDATION
// =============================================================================

describe('Marker Type Structure', () => {
  it('should accept valid marker with all properties', () => {
    const marker: Marker = {
      id: 'test-marker-1',
      x: 50,
      y: 50,
      icon: 'player',
      floor: 0,
      size: 1.5,
    };
    expect(marker.id).toBe('test-marker-1');
    expect(marker.size).toBe(1.5);
  });

  it('should accept marker without optional properties', () => {
    const marker: Marker = {
      id: 'test-marker-2',
      x: 25,
      y: 75,
      icon: 'target',
    };
    expect(marker.floor).toBeUndefined();
    expect(marker.size).toBeUndefined();
  });
});

// =============================================================================
// SVG PATH GENERATION (real code from @/utils/zones)
// =============================================================================

describe('getPolygonPath', () => {
  it('should generate valid SVG path from points', () => {
    const points: Point[] = [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 20 },
      { x: 10, y: 20 },
    ];

    const path = getPolygonPath(points);

    expect(path).toBe('M 10 10 L 20 10 L 20 20 L 10 20 Z');
  });

  it('should return empty string for less than 3 points', () => {
    expect(getPolygonPath([])).toBe('');
    expect(getPolygonPath([{ x: 0, y: 0 }])).toBe('');
    expect(getPolygonPath([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe('');
  });

  it('should handle triangles', () => {
    const points: Point[] = [
      { x: 50, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ];

    const path = getPolygonPath(points);

    expect(path).toBe('M 50 10 L 90 90 L 10 90 Z');
  });
});

describe('getPolygonCentroid', () => {
  it('should calculate centroid of a square', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    const centroid = getPolygonCentroid(points);

    expect(centroid.x).toBe(50);
    expect(centroid.y).toBe(50);
  });

  it('should return origin for empty array', () => {
    const centroid = getPolygonCentroid([]);

    expect(centroid.x).toBe(0);
    expect(centroid.y).toBe(0);
  });

  it('should handle single point', () => {
    const centroid = getPolygonCentroid([{ x: 25, y: 75 }]);

    expect(centroid.x).toBe(25);
    expect(centroid.y).toBe(75);
  });

  it('should calculate centroid of a triangle', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 15, y: 30 },
    ];

    const centroid = getPolygonCentroid(points);

    expect(centroid.x).toBe(15);
    expect(centroid.y).toBe(10);
  });
});

// =============================================================================
// MIGRATION FUNCTIONS (real code from @shared/types)
// =============================================================================

describe('migrateAssignmentToPhases', () => {
  it('should migrate legacy assignment to phase-based zones', () => {
    const legacyZone = { x1: 10, y1: 10, x2: 50, y2: 50 };
    const assignment: Assignment = {
      id: 1,
      name: 'Legacy',
      x: 30,
      y: 30,
      zone: legacyZone,
    };

    const migrated = migrateAssignmentToPhases(assignment);

    expect(migrated.zonesByPhase).toBeDefined();
    expect(migrated.zonesByPhase?.START).toEqual(legacyZone);
    expect(migrated.zonesByPhase?.ATTACK).toEqual(legacyZone);
    expect(migrated.zonesByPhase?.DEFENSE).toEqual(legacyZone);
    expect(migrated.zone).toBeUndefined();
  });

  it('should not modify assignment already using phases', () => {
    const assignment: Assignment = {
      id: 1,
      name: 'Modern',
      x: 30,
      y: 30,
      zonesByPhase: {
        START: { polygons: [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]] },
        ATTACK: { polygons: [[{ x: 30, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 40 }]] },
        DEFENSE: { polygons: [[{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 60, y: 60 }]] },
      },
    };

    const result = migrateAssignmentToPhases(assignment);

    expect(result).toBe(assignment); // Same reference, no change
  });

  it('should not modify assignment without any zone', () => {
    const assignment: Assignment = {
      id: 1,
      name: 'No Zone',
      x: 30,
      y: 30,
    };

    const result = migrateAssignmentToPhases(assignment);

    expect(result).toBe(assignment);
  });
});

describe('migrateMapConfigToPhases', () => {
  it('should migrate all legacy assignments in a map', () => {
    const config: MapConfig = {
      id: 'test-map',
      name: 'Test Map',
      images: ['/test.png'],
      assignments: [
        { id: 1, name: 'A', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
        { id: 2, name: 'B', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
      ],
      players: [],
    };

    const migrated = migrateMapConfigToPhases(config);

    expect(migrated.assignments[0].zonesByPhase).toBeDefined();
    expect(migrated.assignments[1].zonesByPhase).toBeDefined();
    expect(migrated.assignments[0].zone).toBeUndefined();
    expect(migrated.assignments[1].zone).toBeUndefined();
  });

  it('should not modify map with no legacy assignments', () => {
    const config: MapConfig = {
      id: 'test-map',
      name: 'Test Map',
      images: ['/test.png'],
      assignments: [
        {
          id: 1,
          name: 'A',
          x: 25,
          y: 25,
          zonesByPhase: {
            START: { polygons: [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]] },
            ATTACK: { polygons: [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]] },
            DEFENSE: { polygons: [[{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }]] },
          },
        },
      ],
      players: [],
    };

    const result = migrateMapConfigToPhases(config);

    expect(result).toBe(config); // Same reference, no change
  });
});
