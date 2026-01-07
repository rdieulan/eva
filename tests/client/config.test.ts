import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assignmentColors,
  getPlayerAssignments,
  getAssignmentPlayers,
} from '@/config/config';
import type { MapConfig } from '@/types';

// Mock map configuration for testing
function createMockMap(overrides: Partial<MapConfig> = {}): MapConfig {
  return {
    id: 'test-map',
    name: 'Test Map',
    images: ['/maps/test/Test.png'],
    assignments: [
      { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
      { id: 2, name: 'Position 2', x: 50, y: 50, zone: { x1: 45, y1: 45, x2: 55, y2: 55 } },
      { id: 3, name: 'Position 3', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
      { id: 4, name: 'Position 4', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
    ],
    players: [
      { userId: 'user-1', assignmentIds: [1, 2] },
      { userId: 'user-2', assignmentIds: [2, 3] },
      { userId: 'user-3', assignmentIds: [3, 4] },
      { userId: 'user-4', assignmentIds: [1, 4] },
      { userId: 'user-5', assignmentIds: [1, 3] },
    ],
    ...overrides,
  };
}

describe('Assignment Colors', () => {
  it('should have colors for assignments 1-4', () => {
    expect(assignmentColors[1]).toBeDefined();
    expect(assignmentColors[2]).toBeDefined();
    expect(assignmentColors[3]).toBeDefined();
    expect(assignmentColors[4]).toBeDefined();
  });

  it('should have valid hex color format', () => {
    const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

    Object.values(assignmentColors).forEach(color => {
      expect(color).toMatch(hexColorRegex);
    });
  });

  it('should have distinct colors for each assignment', () => {
    const colors = Object.values(assignmentColors);
    const uniqueColors = new Set(colors);

    expect(uniqueColors.size).toBe(colors.length);
  });
});

describe('getPlayerAssignments', () => {
  it('should return assignment IDs for a player', () => {
    const map = createMockMap();

    const assignments = getPlayerAssignments(map, 'user-1');

    expect(assignments).toEqual([1, 2]);
  });

  it('should return empty array for unknown player', () => {
    const map = createMockMap();

    const assignments = getPlayerAssignments(map, 'unknown-user');

    expect(assignments).toEqual([]);
  });

  it('should return empty array when player has no assignments', () => {
    const map = createMockMap({
      players: [{ userId: 'user-1', assignmentIds: [] }],
    });

    const assignments = getPlayerAssignments(map, 'user-1');

    expect(assignments).toEqual([]);
  });
});

describe('getAssignmentPlayers', () => {
  it('should return user IDs assigned to an assignment', () => {
    const map = createMockMap();

    // Assignment 1 is covered by user-1, user-4, user-5
    const players = getAssignmentPlayers(map, 1);

    expect(players).toContain('user-1');
    expect(players).toContain('user-4');
    expect(players).toContain('user-5');
    expect(players).toHaveLength(3);
  });

  it('should return empty array for assignment with no players', () => {
    const map = createMockMap({
      players: [],
    });

    const players = getAssignmentPlayers(map, 1);

    expect(players).toEqual([]);
  });

  it('should return empty array for unknown assignment', () => {
    const map = createMockMap();

    const players = getAssignmentPlayers(map, 999);

    expect(players).toEqual([]);
  });

  it('should return correct players for each assignment', () => {
    const map = createMockMap();

    // Assignment 2 is covered by user-1, user-2
    const players2 = getAssignmentPlayers(map, 2);
    expect(players2).toEqual(['user-1', 'user-2']);

    // Assignment 3 is covered by user-2, user-3, user-5
    const players3 = getAssignmentPlayers(map, 3);
    expect(players3).toContain('user-2');
    expect(players3).toContain('user-3');
    expect(players3).toContain('user-5');
  });
});

