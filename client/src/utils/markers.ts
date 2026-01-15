// Marker utility functions

import type { MarkerIcon } from '@shared/types';
import { MARKER_ICON_PATHS, DEFAULT_MARKER_ICON } from '@/constants';

/**
 * Get the SVG path for a marker icon
 * @param icon - The marker icon type
 * @returns The SVG path string, defaults to 'position' if not found
 */
export function getMarkerIconPath(icon: MarkerIcon): string {
  return MARKER_ICON_PATHS[icon] || MARKER_ICON_PATHS[DEFAULT_MARKER_ICON];
}

