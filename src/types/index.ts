// Types for EVA

// Polygon point
export interface Point {
  x: number;
  y: number;
}

// Zone can be a rectangle (legacy), a polygon, or multiple polygons (multi-zone)
export interface ZoneRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ZonePolygon {
  points: Point[];
}

export interface ZoneMulti {
  polygons: Point[][];
}

export type Zone = ZoneRect | ZonePolygon | ZoneMulti;

// Helper to check if a zone is a simple polygon
export function isZonePolygon(zone: Zone): zone is ZonePolygon {
  return 'points' in zone;
}

// Helper to check if a zone is multi-polygon
export function isZoneMulti(zone: Zone): zone is ZoneMulti {
  return 'polygons' in zone;
}

// Helper to convert a rectangle to polygon
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

// Helper to get all polygons from a zone
export function getZonePolygons(zone: Zone): Point[][] {
  if (isZoneMulti(zone)) {
    return zone.polygons;
  }
  if (isZonePolygon(zone)) {
    return [zone.points];
  }
  // ZoneRect
  return [rectToPolygon(zone).points];
}

// Helper to get points from a zone (first polygon only - legacy)
export function getZonePoints(zone: Zone): Point[] {
  const polygons = getZonePolygons(zone);
  return polygons[0] || [];
}

export interface Assignment {
  id: number;
  name: string;
  x: number;
  y: number;
  zone: Zone;
  floor?: number; // For multi-floor maps (0, 1, etc.)
}

// Player assignment in a game plan (links userId to assignment IDs)
export interface PlayerAssignment {
  userId: string;
  assignmentIds: number[];
}

export interface MapConfig {
  id: string;
  name: string;
  images: string[]; // Support for multiple images (floors)
  assignments: Assignment[];
  players: PlayerAssignment[];
  gamePlans?: { id: string; name: string }[]; // List of available game plans
}

export interface Player {
  id: string;   // cuid from database
  name: string;
}

export interface AppState {
  selectedMap: string | null;
  selectedPlayer: string | null;
  selectedFloor: number;
}
