// Client types - re-exports from shared
export type {
  Point,
  Zone,
  ZoneRect,
  ZonePolygon,
  ZoneMulti,
  Player,
  PlayerAssignment,
  Assignment,
  MapConfig,
  AppState,
} from '../../../shared/types';

// Zone utility functions
export {
  isZonePolygon,
  isZoneMulti,
  isZoneRect,
  rectToPolygon,
  getZonePolygons,
  getZonePoints,
  getPolygonPath,
  getPolygonCentroid,
} from '../utils/zones';

