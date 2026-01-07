import { describe, it, expect } from 'vitest';
import type { MapConfig, Player } from '@/types';

// Test data fixtures for consistent testing across the application

// Mock Players
export const mockPlayers: Player[] = [
  { id: 'player-1', name: 'Sib' },
  { id: 'player-2', name: 'Nyork' },
  { id: 'player-3', name: 'Kazuya' },
  { id: 'player-4', name: 'Shadow' },
  { id: 'player-5', name: 'Phoenix' },
];

// Balanced map configuration (passes all validation rules)
export const balancedMapConfig: MapConfig = {
  id: 'balanced-test-map',
  name: 'Balanced Test Map',
  images: ['/maps/test/Test.png'],
  assignments: [
    { id: 1, name: 'Front', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
    { id: 2, name: 'Back', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 } },
    { id: 3, name: 'Left', x: 25, y: 75, zone: { x1: 20, y1: 70, x2: 30, y2: 80 } },
    { id: 4, name: 'Right', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
  ],
  players: [
    { userId: 'player-1', assignmentIds: [1, 2] },
    { userId: 'player-2', assignmentIds: [2, 3] },
    { userId: 'player-3', assignmentIds: [3, 4] },
    { userId: 'player-4', assignmentIds: [4, 1] },
    { userId: 'player-5', assignmentIds: [1, 3] },
  ],
};

// Unbalanced map - assignment with only one player
export const unbalancedAssignmentMap: MapConfig = {
  id: 'unbalanced-assignment-map',
  name: 'Unbalanced Assignment Map',
  images: ['/maps/test/Test.png'],
  assignments: [
    { id: 1, name: 'Solo Position', x: 50, y: 50, zone: { x1: 45, y1: 45, x2: 55, y2: 55 } },
    { id: 2, name: 'Covered Position', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
  ],
  players: [
    { userId: 'player-1', assignmentIds: [1] }, // Only player on assignment 1
    { userId: 'player-2', assignmentIds: [2] },
    { userId: 'player-3', assignmentIds: [2] },
  ],
};

// Unbalanced map - player with only one assignment
export const unbalancedPlayerMap: MapConfig = {
  id: 'unbalanced-player-map',
  name: 'Unbalanced Player Map',
  images: ['/maps/test/Test.png'],
  assignments: [
    { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
    { id: 2, name: 'Position 2', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
  ],
  players: [
    { userId: 'player-1', assignmentIds: [1] }, // Only one assignment
    { userId: 'player-2', assignmentIds: [1, 2] },
    { userId: 'player-3', assignmentIds: [1, 2] },
  ],
};

// Unbalanced map - player with too many assignments
export const overloadedPlayerMap: MapConfig = {
  id: 'overloaded-player-map',
  name: 'Overloaded Player Map',
  images: ['/maps/test/Test.png'],
  assignments: [
    { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
    { id: 2, name: 'Position 2', x: 50, y: 50, zone: { x1: 45, y1: 45, x2: 55, y2: 55 } },
    { id: 3, name: 'Position 3', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
  ],
  players: [
    { userId: 'player-1', assignmentIds: [1, 2, 3] }, // 3 assignments - too many
    { userId: 'player-2', assignmentIds: [1, 2] },
    { userId: 'player-3', assignmentIds: [2, 3] },
  ],
};

// Duplicate pair map - two assignments with same player pair
export const duplicatePairMap: MapConfig = {
  id: 'duplicate-pair-map',
  name: 'Duplicate Pair Map',
  images: ['/maps/test/Test.png'],
  assignments: [
    { id: 1, name: 'Position 1', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 } },
    { id: 2, name: 'Position 2', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 } },
  ],
  players: [
    { userId: 'player-1', assignmentIds: [1, 2] },
    { userId: 'player-2', assignmentIds: [1, 2] },
    // Both positions covered by same pair
  ],
};

// Multi-floor map
export const multiFloorMap: MapConfig = {
  id: 'multi-floor-map',
  name: 'Multi Floor Map',
  images: ['/maps/test/Floor0.png', '/maps/test/Floor1.png'],
  assignments: [
    { id: 1, name: 'Ground Front', x: 25, y: 25, zone: { x1: 20, y1: 20, x2: 30, y2: 30 }, floor: 0 },
    { id: 2, name: 'Ground Back', x: 75, y: 25, zone: { x1: 70, y1: 20, x2: 80, y2: 30 }, floor: 0 },
    { id: 3, name: 'Upper Left', x: 25, y: 75, zone: { x1: 20, y1: 70, x2: 30, y2: 80 }, floor: 1 },
    { id: 4, name: 'Upper Right', x: 75, y: 75, zone: { x1: 70, y1: 70, x2: 80, y2: 80 }, floor: 1 },
  ],
  players: [
    { userId: 'player-1', assignmentIds: [1, 3] },
    { userId: 'player-2', assignmentIds: [2, 4] },
    { userId: 'player-3', assignmentIds: [1, 4] },
    { userId: 'player-4', assignmentIds: [2, 3] },
    { userId: 'player-5', assignmentIds: [1, 2] },
  ],
};

// Polygon zone map (complex zones)
export const polygonZoneMap: MapConfig = {
  id: 'polygon-zone-map',
  name: 'Polygon Zone Map',
  images: ['/maps/test/Test.png'],
  assignments: [
    {
      id: 1,
      name: 'Complex Zone',
      x: 50,
      y: 50,
      zone: {
        polygons: [
          [
            { x: 40, y: 40 },
            { x: 60, y: 40 },
            { x: 65, y: 50 },
            { x: 60, y: 60 },
            { x: 40, y: 60 },
            { x: 35, y: 50 },
          ],
        ],
      },
    },
  ],
  players: [
    { userId: 'player-1', assignmentIds: [1] },
    { userId: 'player-2', assignmentIds: [1] },
  ],
};

// Multi-polygon zone map
export const multiPolygonZoneMap: MapConfig = {
  id: 'multi-polygon-map',
  name: 'Multi Polygon Map',
  images: ['/maps/test/Test.png'],
  assignments: [
    {
      id: 1,
      name: 'Split Zone',
      x: 50,
      y: 50,
      zone: {
        polygons: [
          // First piece
          [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 30 },
            { x: 10, y: 30 },
          ],
          // Second piece
          [
            { x: 70, y: 70 },
            { x: 90, y: 70 },
            { x: 90, y: 90 },
            { x: 70, y: 90 },
          ],
        ],
      },
    },
  ],
  players: [
    { userId: 'player-1', assignmentIds: [1] },
    { userId: 'player-2', assignmentIds: [1] },
  ],
};

// Empty map
export const emptyMap: MapConfig = {
  id: 'empty-map',
  name: 'Empty Map',
  images: ['/maps/test/Empty.png'],
  assignments: [],
  players: [],
};

describe('Test Fixtures', () => {
  it('should have valid balanced map configuration', () => {
    expect(balancedMapConfig.assignments).toHaveLength(4);
    expect(balancedMapConfig.players).toHaveLength(5);

    // Each assignment should have at least 2 players
    for (const assignment of balancedMapConfig.assignments) {
      const playersOnAssignment = balancedMapConfig.players.filter(p =>
        p.assignmentIds.includes(assignment.id)
      );
      expect(playersOnAssignment.length).toBeGreaterThanOrEqual(2);
    }

    // Each player should have 2 assignments
    for (const player of balancedMapConfig.players) {
      expect(player.assignmentIds).toHaveLength(2);
    }
  });

  it('should have valid mock players', () => {
    expect(mockPlayers).toHaveLength(5);

    // All players should have unique IDs
    const ids = mockPlayers.map(p => p.id);
    expect(new Set(ids).size).toBe(5);

    // All players should have names
    mockPlayers.forEach(player => {
      expect(player.name).toBeTruthy();
    });
  });

  it('should have multi-floor map with valid floor assignments', () => {
    expect(multiFloorMap.images).toHaveLength(2);

    const floor0Assignments = multiFloorMap.assignments.filter(a => a.floor === 0);
    const floor1Assignments = multiFloorMap.assignments.filter(a => a.floor === 1);

    expect(floor0Assignments).toHaveLength(2);
    expect(floor1Assignments).toHaveLength(2);
  });
});

