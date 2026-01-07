// Zone utility functions

import type { Zone, ZonePolygon, ZoneMulti, ZoneRect, Point } from '../../../shared/types';

// Type guards

export function isZonePolygon(zone: Zone): zone is ZonePolygon {
  return 'points' in zone;
}

export function isZoneMulti(zone: Zone): zone is ZoneMulti {
  return 'polygons' in zone;
}

export function isZoneRect(zone: Zone): zone is ZoneRect {
  return 'x1' in zone && 'y1' in zone && 'x2' in zone && 'y2' in zone;
}

// Conversions

export function rectToPolygon(zone: ZoneRect): ZonePolygon {
  return {
    points: [
      { x: zone.x1, y: zone.y1 },
      { x: zone.x2, y: zone.y1 },
      { x: zone.x2, y: zone.y2 },
      { x: zone.x1, y: zone.y2 },
    ]
  };
}

// Get all polygons from a zone (handles all zone types)
export function getZonePolygons(zone: Zone): Point[][] {
  if (isZoneMulti(zone)) {
    return zone.polygons;
  }
  if (isZonePolygon(zone)) {
    return [zone.points];
  }
  // ZoneRect - convert to polygon
  return [rectToPolygon(zone).points];
}

// Get points from a zone (first polygon only - for legacy/simple use)
export function getZonePoints(zone: Zone): Point[] {
  const polygons = getZonePolygons(zone);
  return polygons[0] || [];
}

// Generate SVG path from polygon points
export function getPolygonPath(points: Point[]): string {
  if (points.length < 3) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
}

// Calculate polygon centroid
export function getPolygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };

  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

