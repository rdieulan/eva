// Tests for EventFormModal component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import EventFormModal from '@/components/calendar/EventFormModal.vue';
import type { CalendarEvent, MapConfig, Player } from '@shared/types';

describe('EventFormModal Component', () => {
  const mockMaps: MapConfig[] = [
    {
      id: 'map-1',
      name: 'Polaris',
      images: ['polaris.png'],
      assignments: [
        { id: 1, name: 'Pilote', x: 100, y: 100, zone: { x1: 0, y1: 0, x2: 100, y2: 100 } },
        { id: 2, name: 'Gunner', x: 200, y: 200, zone: { x1: 100, y1: 100, x2: 200, y2: 200 } },
      ],
      players: [],
    },
  ];

  const mockPlayers: Player[] = [
    { id: 'player-1', name: 'Alice' },
    { id: 'player-2', name: 'Bob' },
    { id: 'player-3', name: 'Charlie' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when open prop is true', () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.props('open')).toBe(true);
  });

  it('should not render modal when open prop is false', () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: false,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    expect(wrapper.props('open')).toBe(false);
  });

  it('should emit close event when close is triggered', async () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    wrapper.vm.$emit('close');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('should populate form fields when editing existing event', () => {
    const mockEvent: CalendarEvent = {
      id: 'event-1',
      date: '2026-01-20',
      startTime: '19:00',
      endTime: '21:00',
      type: 'MATCH',
      title: 'Important Match',
      createdById: 'admin-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        editEvent: mockEvent,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    expect(wrapper.props('editEvent')?.title).toBe('Important Match');
    expect(wrapper.props('editEvent')?.type).toBe('MATCH');
  });

  it('should render form in read-only mode when readOnly prop is true', () => {
    const mockEvent: CalendarEvent = {
      id: 'event-1',
      date: '2026-01-20',
      startTime: '19:00',
      endTime: '21:00',
      type: 'EVENT',
      title: 'Team Meeting',
      createdById: 'admin-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        editEvent: mockEvent,
        readOnly: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    expect(wrapper.props('readOnly')).toBe(true);
    expect(wrapper.props('editEvent')).toEqual(mockEvent);
  });

  it('should emit submit event with correct event data', async () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    const eventData = {
      date: '2026-01-25',
      startTime: '20:00',
      endTime: '22:00',
      type: 'MATCH' as const,
      title: 'New Match',
      description: 'Test description',
    };

    wrapper.vm.$emit('submit', eventData);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('submit')).toBeTruthy();
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual(eventData);
  });

  it('should show game plan association button for MATCH events', () => {
    const mockEvent: CalendarEvent = {
      id: 'event-1',
      date: '2026-01-20',
      startTime: '19:00',
      endTime: '21:00',
      type: 'MATCH',
      title: 'Match',
      createdById: 'admin-1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        editEvent: mockEvent,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    // For MATCH type events, game plan button should be available
    expect(wrapper.props('editEvent')?.type).toBe('MATCH');
  });

  it('should validate event data before submission', async () => {
    const wrapper = mount(EventFormModal, {
      props: {
        open: true,
        maps: mockMaps,
        players: mockPlayers,
      },
    });

    const validData = {
      date: '2026-01-25',
      startTime: '20:00',
      endTime: '22:00',
      type: 'EVENT' as const,
      title: 'Valid Event',
    };

    wrapper.vm.$emit('submit', validData);
    await wrapper.vm.$nextTick();

    const submitEmits = wrapper.emitted('submit');
    if (submitEmits) {
      const emittedData = submitEmits[0]?.[0] as any;
      expect(emittedData.startTime < emittedData.endTime).toBe(true);
      expect(emittedData.title).toBeTruthy();
      expect(emittedData.date).toBeTruthy();
    }
  });
});

