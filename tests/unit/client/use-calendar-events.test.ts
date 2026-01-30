/**
 * Tests for useCalendarEvents composable
 * Tests modal state management, event CRUD, and permissions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed } from 'vue';
import { useCalendarEvents } from '@/composables/useCalendarEvents';
import type { CalendarEvent } from '@shared/types';

// Mock the API calls
vi.mock('@/api/calendar.api', () => ({
  createEvent: vi.fn().mockResolvedValue({}),
  updateEvent: vi.fn().mockResolvedValue({}),
  deleteEvent: vi.fn().mockResolvedValue({}),
  updateEventGamePlan: vi.fn().mockResolvedValue({}),
}));

describe('useCalendarEvents', () => {
  const mockReloadData = vi.fn().mockResolvedValue(undefined);
  const mockOnError = vi.fn();

  const createOptions = (overrides = {}) => ({
    canCreate: computed(() => true),
    canEdit: computed(() => true),
    canDelete: computed(() => true),
    reloadData: mockReloadData,
    onError: mockOnError,
    ...overrides,
  });

  const createMockEvent = (id: string, date: string): CalendarEvent => ({
    id,
    date,
    startTime: '20:00',
    endTime: '22:00',
    type: 'MATCH',
    title: 'Test Match',
    description: undefined,
    gamePlan: undefined,
    createdById: 'user-1',
    createdAt: '2026-01-20T10:00:00Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should have closed modals by default', () => {
      const { showEventModal, showEventViewer } = useCalendarEvents(createOptions());

      expect(showEventModal.value).toBe(false);
      expect(showEventViewer.value).toBe(false);
    });

    it('should have empty viewer events', () => {
      const { viewerEvents, viewerInitialIndex } = useCalendarEvents(createOptions());

      expect(viewerEvents.value).toEqual([]);
      expect(viewerInitialIndex.value).toBe(0);
    });
  });

  describe('Event Viewer', () => {
    it('should open viewer with events', () => {
      const { openEventViewer, showEventViewer, viewerEvents, viewerInitialIndex } =
        useCalendarEvents(createOptions());

      const events = [
        createMockEvent('1', '2026-01-20'),
        createMockEvent('2', '2026-01-20'),
      ];

      openEventViewer(events, 1);

      expect(showEventViewer.value).toBe(true);
      expect(viewerEvents.value).toEqual(events);
      expect(viewerInitialIndex.value).toBe(1);
    });

    it('should not open viewer with empty events', () => {
      const { openEventViewer, showEventViewer } = useCalendarEvents(createOptions());

      openEventViewer([], 0);

      expect(showEventViewer.value).toBe(false);
    });

    it('should close viewer and clear events', () => {
      const { openEventViewer, closeEventViewer, showEventViewer, viewerEvents } =
        useCalendarEvents(createOptions());

      openEventViewer([createMockEvent('1', '2026-01-20')], 0);
      closeEventViewer();

      expect(showEventViewer.value).toBe(false);
      expect(viewerEvents.value).toEqual([]);
    });
  });

  describe('Event Form Modal', () => {
    it('should open create modal with date', () => {
      const { openCreateEvent, showEventModal, selectedDate, editingEvent } =
        useCalendarEvents(createOptions());

      openCreateEvent('2026-01-20');

      expect(showEventModal.value).toBe(true);
      expect(selectedDate.value).toBe('2026-01-20');
      expect(editingEvent.value).toBeUndefined();
    });

    it('should not open create modal without permission', () => {
      const { openCreateEvent, showEventModal } = useCalendarEvents(
        createOptions({ canCreate: computed(() => false) })
      );

      openCreateEvent('2026-01-20');

      expect(showEventModal.value).toBe(false);
    });

    it('should open edit modal from viewer', () => {
      const {
        openEventViewer,
        editEventFromViewer,
        showEventModal,
        showEventViewer,
        editingEvent,
        selectedDate,
      } = useCalendarEvents(createOptions());

      const event = createMockEvent('1', '2026-01-20');
      openEventViewer([event], 0);
      editEventFromViewer(event);

      expect(showEventViewer.value).toBe(false);
      expect(showEventModal.value).toBe(true);
      expect(editingEvent.value).toEqual(event);
      expect(selectedDate.value).toBe('2026-01-20');
    });

    it('should open create modal from viewer', () => {
      const {
        openEventViewer,
        createEventFromViewer,
        showEventModal,
        showEventViewer,
        editingEvent,
        selectedDate,
      } = useCalendarEvents(createOptions());

      openEventViewer([createMockEvent('1', '2026-01-20')], 0);
      createEventFromViewer('2026-01-21');

      expect(showEventViewer.value).toBe(false);
      expect(showEventModal.value).toBe(true);
      expect(editingEvent.value).toBeUndefined();
      expect(selectedDate.value).toBe('2026-01-21');
    });
  });

  describe('CRUD Operations', () => {
    it('should create event and reload data', async () => {
      const { createEvent } = await import('@/api/calendar.api');
      const { submitEvent, showEventModal } = useCalendarEvents(createOptions());

      showEventModal.value = true;

      await submitEvent({
        date: '2026-01-20',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH',
        title: 'New Match',
      });

      expect(createEvent).toHaveBeenCalled();
      expect(mockReloadData).toHaveBeenCalled();
      expect(showEventModal.value).toBe(false);
    });

    it('should update event when editing', async () => {
      const { updateEvent } = await import('@/api/calendar.api');
      const { submitEvent, editingEvent, showEventModal } = useCalendarEvents(createOptions());

      editingEvent.value = createMockEvent('1', '2026-01-20');
      showEventModal.value = true;

      await submitEvent({
        date: '2026-01-20',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH',
        title: 'Updated Match',
      });

      expect(updateEvent).toHaveBeenCalledWith('1', expect.any(Object));
      expect(mockReloadData).toHaveBeenCalled();
    });

    it('should delete event and reload data', async () => {
      const { deleteEvent } = await import('@/api/calendar.api');
      const { removeEvent, showEventModal } = useCalendarEvents(createOptions());

      showEventModal.value = true;

      await removeEvent('1');

      expect(deleteEvent).toHaveBeenCalledWith('1');
      expect(mockReloadData).toHaveBeenCalled();
      expect(showEventModal.value).toBe(false);
    });

    it('should update game plan and reload data', async () => {
      const { updateEventGamePlan } = await import('@/api/calendar.api');
      const { updateGamePlan, showEventModal } = useCalendarEvents(createOptions());

      showEventModal.value = true;

      const gamePlan = {
        absentPlayerId: 'player-1',
        absentPlayerName: 'Test',
        maps: [],
      };

      await updateGamePlan('1', gamePlan);

      expect(updateEventGamePlan).toHaveBeenCalledWith('1', gamePlan);
      expect(mockReloadData).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should call onError when submit fails', async () => {
      const { createEvent } = await import('@/api/calendar.api');
      vi.mocked(createEvent).mockRejectedValueOnce(new Error('API Error'));

      const { submitEvent } = useCalendarEvents(createOptions());

      await submitEvent({
        date: '2026-01-20',
        startTime: '20:00',
        endTime: '22:00',
        type: 'MATCH',
        title: 'New Match',
      });

      expect(mockOnError).toHaveBeenCalled();
    });

    it('should call onError when delete fails', async () => {
      const { deleteEvent } = await import('@/api/calendar.api');
      vi.mocked(deleteEvent).mockRejectedValueOnce(new Error('API Error'));

      const { removeEvent } = useCalendarEvents(createOptions());

      await removeEvent('1');

      expect(mockOnError).toHaveBeenCalled();
    });
  });
});
