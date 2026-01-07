// Zone types for map overlays

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

