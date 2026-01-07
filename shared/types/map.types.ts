// Map and assignment types

import type { Zone } from './zone.types';
import type { PlayerAssignment } from './player.types';

export interface Assignment {
  id: number;
  name: string;
  x: number;
  y: number;
  zone: Zone;
  floor?: number; // For multi-floor maps (0, 1, etc.)
}

export interface MapConfig {
  id: string;
  name: string;
  images: string[]; // Support for multiple images (floors)
  assignments: Assignment[];
  players: PlayerAssignment[];
  gamePlans?: { id: string; name: string }[]; // List of available game plans
}

export interface AppState {
  selectedMap: string | null;
  selectedPlayer: string | null;
  selectedFloor: number;
}

