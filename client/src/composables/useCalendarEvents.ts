/**
 * Composable for calendar events management
 * Handles event modals, CRUD operations
 */

import { ref, type Ref, type ComputedRef, computed } from 'vue';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventGamePlan,
} from '@/api/calendar.api';
import type { CalendarEvent, CreateEventRequest, MatchGamePlan, DayData } from '@shared/types';

export interface UseCalendarEventsOptions {
  days: Ref<Record<string, DayData>>;
  canEdit: ComputedRef<boolean>;
  reloadData: () => Promise<void>;
}

export interface UseCalendarEventsReturn {
  // Event form modal state
  showEventModal: Ref<boolean>;
  selectedDate: Ref<string>;
  editingEvent: Ref<CalendarEvent | undefined>;

  // Event viewer modal state
  showEventViewer: Ref<boolean>;
  viewerEvents: Ref<CalendarEvent[]>;
  viewerInitialIndex: Ref<number>;

  // Permissions
  canCreateEvents: ComputedRef<boolean>;

  // Event viewer methods
  openEventViewer: (events: CalendarEvent[], initialIndex: number) => void;
  closeEventViewer: () => void;

  // Event form methods
  openCreateEvent: (date: string) => void;
  editEventFromViewer: (event: CalendarEvent) => void;
  createEventFromViewer: (date: string) => void;

  // CRUD methods
  submitEvent: (eventData: CreateEventRequest) => Promise<void>;
  removeEvent: (eventId: string) => Promise<void>;
  updateGamePlan: (eventId: string, gamePlan: MatchGamePlan) => Promise<void>;
}

export function useCalendarEvents(options: UseCalendarEventsOptions): UseCalendarEventsReturn {
  const { canEdit, reloadData } = options;

  // Event form modal state
  const showEventModal = ref(false);
  const selectedDate = ref('');
  const editingEvent = ref<CalendarEvent | undefined>(undefined);

  // Event viewer modal state
  const showEventViewer = ref(false);
  const viewerEvents = ref<CalendarEvent[]>([]);
  const viewerInitialIndex = ref(0);

  // Permissions
  const canCreateEvents = computed(() => canEdit.value);

  // Open event viewer modal (read-only with navigation)
  function openEventViewer(events: CalendarEvent[], initialIndex: number) {
    if (events.length === 0) return;
    viewerEvents.value = events;
    viewerInitialIndex.value = initialIndex;
    showEventViewer.value = true;
  }

  // Close event viewer
  function closeEventViewer() {
    showEventViewer.value = false;
    viewerEvents.value = [];
  }

  // Open edit modal for an event (from viewer)
  function editEventFromViewer(event: CalendarEvent) {
    closeEventViewer();
    editingEvent.value = event;
    selectedDate.value = event.date;
    showEventModal.value = true;
  }

  // Open create modal for a date (from viewer)
  function createEventFromViewer(date: string) {
    closeEventViewer();
    editingEvent.value = undefined;
    selectedDate.value = date;
    showEventModal.value = true;
  }

  // Open create event modal directly
  function openCreateEvent(date: string) {
    if (!canCreateEvents.value) return;
    editingEvent.value = undefined;
    selectedDate.value = date;
    showEventModal.value = true;
  }

  // Create or update event
  async function submitEvent(eventData: CreateEventRequest) {
    try {
      if (editingEvent.value) {
        await updateEvent(editingEvent.value.id, eventData);
      } else {
        await createEvent(eventData);
      }

      showEventModal.value = false;
      await reloadData();
    } catch (err) {
      console.error('Error saving event:', err);
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  }

  // Delete event
  async function removeEvent(eventId: string) {
    try {
      await deleteEvent(eventId);
      showEventModal.value = false;
      await reloadData();
    } catch (err) {
      console.error('Error deleting event:', err);
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  }

  // Update game plan for an event
  async function updateGamePlan(eventId: string, gamePlan: MatchGamePlan) {
    try {
      await updateEventGamePlan(eventId, gamePlan);
      showEventModal.value = false;
      await reloadData();
    } catch (err) {
      console.error('Error updating game plan:', err);
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return {
    // Event form modal state
    showEventModal,
    selectedDate,
    editingEvent,

    // Event viewer modal state
    showEventViewer,
    viewerEvents,
    viewerInitialIndex,

    // Permissions
    canCreateEvents,

    // Event viewer methods
    openEventViewer,
    closeEventViewer,

    // Event form methods
    openCreateEvent,
    editEventFromViewer,
    createEventFromViewer,

    // CRUD methods
    submitEvent,
    removeEvent,
    updateGamePlan,
  };
}
