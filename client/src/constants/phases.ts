// Phase display data (icons and colors)
// Centralized configuration for phase visual representation

import type { GamePhase } from '@shared/types';

/**
 * Phase display configuration with icon and color
 */
export interface PhaseDisplayData {
  icon: string;
  color: string;
}

/**
 * Display data for each game phase
 */
export const PHASE_DISPLAY_DATA: Record<GamePhase, PhaseDisplayData> = {
  START: { icon: 'flag', color: '#4ade80' },
  ATTACK: { icon: 'sword', color: '#ff6b6b' },
  DEFENSE: { icon: 'shield', color: '#60a5fa' },
};

/**
 * Get display data for a specific phase
 */
export function getPhaseDisplayData(phase: GamePhase): PhaseDisplayData {
  return PHASE_DISPLAY_DATA[phase];
}

