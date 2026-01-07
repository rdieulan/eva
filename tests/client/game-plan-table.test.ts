// Tests for GamePlanTable component
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GamePlanTable from '@/components/common/GamePlanTable.vue';
import type { MatchGamePlan } from '@shared/types';

describe('GamePlanTable Component', () => {
  const mockHeaders = [
    { id: 'player-1', name: 'Alice' },
    { id: 'player-2', name: 'Bob' },
    { id: 'player-3', name: 'Charlie' },
  ];

  const mockGamePlan: MatchGamePlan = {
    absentPlayerId: 'player-4',
    absentPlayerName: 'David',
    maps: [
      {
        mapId: 'map-1',
        mapName: 'Polaris',
        assignments: [
          {
            visibleplayerId: 'player-1',
            visibleplayerName: 'Alice',
            assignmentId: 1,
            assignmentName: 'Pilote',
            assignmentColor: '#FF0000',
          },
          {
            visibleplayerId: 'player-2',
            visibleplayerName: 'Bob',
            assignmentId: 2,
            assignmentName: 'Gunner',
            assignmentColor: '#00FF00',
          },
          {
            visibleplayerId: 'player-3',
            visibleplayerName: 'Charlie',
            assignmentId: 3,
            assignmentName: 'Engineer',
            assignmentColor: '#0000FF',
          },
        ],
      },
      {
        mapId: 'map-2',
        mapName: 'Atlantis',
        assignments: [
          {
            visibleplayerId: 'player-2',
            visibleplayerName: 'Bob',
            assignmentId: 1,
            assignmentName: 'Pilote',
            assignmentColor: '#FF0000',
          },
          {
            visibleplayerId: 'player-1',
            visibleplayerName: 'Alice',
            assignmentId: 2,
            assignmentName: 'Gunner',
            assignmentColor: '#00FF00',
          },
          {
            visibleplayerId: 'player-3',
            visibleplayerName: 'Charlie',
            assignmentId: 3,
            assignmentName: 'Engineer',
            assignmentColor: '#0000FF',
          },
        ],
      },
    ],
  };

  it('should render table with headers', () => {
    const wrapper = mount(GamePlanTable, {
      props: {
        headers: mockHeaders,
        gamePlan: mockGamePlan,
      },
    });

    const headers = wrapper.findAll('th');
    expect(headers).toHaveLength(4); // Map + 3 players
    expect(headers[0].text()).toBe('Map');
    expect(headers[1].text()).toBe('Alice');
    expect(headers[2].text()).toBe('Bob');
    expect(headers[3].text()).toBe('Charlie');
  });

  it('should render all maps as rows', () => {
    const wrapper = mount(GamePlanTable, {
      props: {
        headers: mockHeaders,
        gamePlan: mockGamePlan,
      },
    });

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);

    const firstRowMapName = rows[0].find('.map-name');
    expect(firstRowMapName?.text()).toBe('Polaris');

    const secondRowMapName = rows[1].find('.map-name');
    expect(secondRowMapName?.text()).toBe('Atlantis');
  });

  it('should display assignments with correct colors', () => {
    const wrapper = mount(GamePlanTable, {
      props: {
        headers: mockHeaders,
        gamePlan: mockGamePlan,
      },
    });

    const firstRow = wrapper.findAll('tbody tr')[0];
    const badges = firstRow.findAll('.assignment-badge');

    // Alice should be Pilote on Polaris
    expect(badges[0].text()).toBe('Pilote');
    expect(badges[0].attributes('style')).toContain('#FF0000');

    // Bob should be Gunner on Polaris
    expect(badges[1].text()).toBe('Gunner');
    expect(badges[1].attributes('style')).toContain('#00FF00');
  });

  it('should handle player with no assignment (show dash)', () => {
    const gamePlanWithMissingAssignment: MatchGamePlan = {
      ...mockGamePlan,
      maps: [
        {
          mapId: 'map-1',
          mapName: 'Test Map',
          assignments: [
            {
              visibleplayerId: 'player-1',
              visibleplayerName: 'Alice',
              assignmentId: 1,
              assignmentName: 'Pilote',
              assignmentColor: '#FF0000',
            },
            // player-2 has no assignment
            {
              visibleplayerId: 'player-3',
              visibleplayerName: 'Charlie',
              assignmentId: 3,
              assignmentName: 'Engineer',
              assignmentColor: '#0000FF',
            },
          ],
        },
      ],
    };

    const wrapper = mount(GamePlanTable, {
      props: {
        headers: mockHeaders,
        gamePlan: gamePlanWithMissingAssignment,
      },
    });

    const badges = wrapper.findAll('.assignment-badge');
    expect(badges[1].text()).toBe('—'); // Bob has no assignment
    expect(badges[1].attributes('style')).toContain('opacity');
  });

  it('should render empty table when no maps', () => {
    const emptyGamePlan: MatchGamePlan = {
      absentPlayerId: 'player-4',
      absentPlayerName: 'David',
      maps: [],
    };

    const wrapper = mount(GamePlanTable, {
      props: {
        headers: mockHeaders,
        gamePlan: emptyGamePlan,
      },
    });

    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('should handle assignments in different order per map', () => {
    // This tests that the component correctly aligns players by ID, not by array position
    const wrapper = mount(GamePlanTable, {
      props: {
        headers: mockHeaders,
        gamePlan: mockGamePlan,
      },
    });

    const rows = wrapper.findAll('tbody tr');

    // First map: Alice=Pilote, Bob=Gunner, Charlie=Engineer
    const firstRowBadges = rows[0].findAll('.assignment-badge');
    expect(firstRowBadges[0].text()).toBe('Pilote'); // Alice
    expect(firstRowBadges[1].text()).toBe('Gunner'); // Bob
    expect(firstRowBadges[2].text()).toBe('Engineer'); // Charlie

    // Second map: Bob=Pilote, Alice=Gunner, Charlie=Engineer (different order in data)
    const secondRowBadges = rows[1].findAll('.assignment-badge');
    expect(secondRowBadges[0].text()).toBe('Gunner'); // Alice (not Pilote)
    expect(secondRowBadges[1].text()).toBe('Pilote'); // Bob (not Gunner)
    expect(secondRowBadges[2].text()).toBe('Engineer'); // Charlie
  });
});

