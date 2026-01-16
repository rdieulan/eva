import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPlayerAssignments,
  getPlayerMainAssignment,
  getAssignmentPlayers,
} from '@/utils/balance';
import type { MapConfig } from '@shared/types';

// =============================================================================
// REAL BALANCE SERVICE FUNCTIONS TESTS
// =============================================================================

describe('Balance Service - getPlayerAssignments (real code)', () => {
  const mockMap: MapConfig = {
    id: 'test-map',
    name: 'Test Map',
    images: ['/maps/test/Test.png'],
    assignments: [
      { id: 1, name: 'Front', x: 25, y: 25 },
      { id: 2, name: 'Back', x: 75, y: 25 },
      { id: 3, name: 'Left', x: 25, y: 75 },
    ],
    players: [
      { userId: 'player-1', assignmentIds: [1, 2] },
      { userId: 'player-2', assignmentIds: [2, 3] },
      { userId: 'player-3', assignmentIds: [1] },
    ],
  };

  it('should return assignment IDs for a known player', () => {
    const result = getPlayerAssignments(mockMap, 'player-1');
    expect(result).toEqual([1, 2]);
  });

  it('should return empty array for unknown player', () => {
    const result = getPlayerAssignments(mockMap, 'unknown-player');
    expect(result).toEqual([]);
  });

  it('should return single assignment for player with one role', () => {
    const result = getPlayerAssignments(mockMap, 'player-3');
    expect(result).toEqual([1]);
  });
});

describe('Balance Service - getPlayerMainAssignment (real code)', () => {
  const mockMap: MapConfig = {
    id: 'test-map',
    name: 'Test Map',
    images: ['/maps/test/Test.png'],
    assignments: [
      { id: 1, name: 'Front', x: 25, y: 25 },
      { id: 2, name: 'Back', x: 75, y: 25 },
    ],
    players: [
      { userId: 'player-1', assignmentIds: [1, 2], mainAssignmentId: 1 },
      { userId: 'player-2', assignmentIds: [1, 2] },
    ],
  };

  it('should return main assignment ID when defined', () => {
    const result = getPlayerMainAssignment(mockMap, 'player-1');
    expect(result).toBe(1);
  });

  it('should return null when no main assignment defined', () => {
    const result = getPlayerMainAssignment(mockMap, 'player-2');
    expect(result).toBeNull();
  });

  it('should return null for unknown player', () => {
    const result = getPlayerMainAssignment(mockMap, 'unknown-player');
    expect(result).toBeNull();
  });
});

describe('Balance Service - getAssignmentPlayers (real code)', () => {
  const mockMap: MapConfig = {
    id: 'test-map',
    name: 'Test Map',
    images: ['/maps/test/Test.png'],
    assignments: [
      { id: 1, name: 'Front', x: 25, y: 25 },
      { id: 2, name: 'Back', x: 75, y: 25 },
      { id: 3, name: 'Unused', x: 50, y: 50 },
    ],
    players: [
      { userId: 'player-1', assignmentIds: [1, 2] },
      { userId: 'player-2', assignmentIds: [1] },
      { userId: 'player-3', assignmentIds: [2] },
    ],
  };

  it('should return all player IDs for a given assignment', () => {
    const result = getAssignmentPlayers(mockMap, 1);
    expect(result).toEqual(['player-1', 'player-2']);
  });

  it('should return empty array for assignment with no players', () => {
    const result = getAssignmentPlayers(mockMap, 3);
    expect(result).toEqual([]);
  });

  it('should return empty array for unknown assignment', () => {
    const result = getAssignmentPlayers(mockMap, 999);
    expect(result).toEqual([]);
  });
});

