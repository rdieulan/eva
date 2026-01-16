// Marker utility functions

import type { MarkerIcon, Marker } from '@shared/types';
import { MARKER_ICON_PATHS, DEFAULT_MARKER_ICON } from '@/constants';

/**
 * Default marker size
 */
export const DEFAULT_MARKER_SIZE = 1;

/**
 * Get the SVG path for a marker icon
 * @param icon - The marker icon type
 * @returns The SVG path string, defaults to 'position' if not found
 */
export function getMarkerIconPath(icon: MarkerIcon): string {
  return MARKER_ICON_PATHS[icon] || MARKER_ICON_PATHS[DEFAULT_MARKER_ICON];
}

/**
 * Get the size of a marker (with fallback to default)
 * @param marker - The marker object or just the size value
 * @returns The marker size
 */
export function getMarkerSize(marker: Marker | number | undefined): number {
  if (marker === undefined) return DEFAULT_MARKER_SIZE;
  if (typeof marker === 'number') return marker;
  return marker.size ?? DEFAULT_MARKER_SIZE;
}

