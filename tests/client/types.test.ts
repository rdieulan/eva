import { describe, it, expect } from 'vitest';
import {
  isZonePolygon,
  isZoneMulti,
  rectToPolygon,
  getZonePolygons,
  getZonePoints,
} from '@/utils/zones';
import type { ZoneRect, ZonePolygon, ZoneMulti, Point } from '@/types';

describe('Zone Type Guards', () => {
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

    it('should return false for a polygon zone', () => {
      const zone: ZonePolygon = {
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
      };
      expect(isZoneMulti(zone)).toBe(false);
    });
  });
});

describe('Zone Conversion', () => {
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

    it('should handle zero-size rectangle', () => {
      const rect: ZoneRect = { x1: 50, y1: 50, x2: 50, y2: 50 };
      const polygon = rectToPolygon(rect);

      expect(polygon.points).toHaveLength(4);
      polygon.points.forEach(point => {
        expect(point).toEqual({ x: 50, y: 50 });
      });
    });
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

