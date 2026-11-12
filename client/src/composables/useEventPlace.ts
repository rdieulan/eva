// Where a match of the calendar is played: the venue, its arena when it runs
// several, and the slots eva.gg lists there that day. A match on a listed
// venue runs on consecutive slots of one arena: its hours, and its arena, come
// from them, and the hours are typed by hand only when there is no grid to
// pick from.

import { computed, ref, watch, type Ref } from 'vue';
import type { Venue, VenueSlot } from '@shared/types';
import type { VenueSlotsStatus } from '@/composables/useVenueSlots';

/** A place to start from: the event's own, or the team's venue for a new match */
export interface EventPlace {
  venueId: string | null;
  arenaNumber: number | null;
  evaSlotIds: string[];
}

export function useEventPlace(options: {
  venues: () => Venue[] | undefined; // The venues a match can be played in
  isMatch: Ref<boolean>; // Only a match is played somewhere
  date: Ref<string>;
  startTime: Ref<string>; // Set, with endTime, by the slots picked
  endTime: Ref<string>;
}) {
  const venueId = ref<string | null>(null);
  const arenaNumber = ref<number | null>(null);
  const evaSlotIds = ref<string[]>([]);

  const selectedVenue = computed(() => options.venues()?.find(venue => venue.id === venueId.value) ?? null);

  // Arenas of the chosen venue, numbered 1 upwards. Only worth asking about when
  // the venue runs several of them.
  const arenaNumbers = computed(() => {
    const count = selectedVenue.value?.arenaCount ?? 1;
    return count > 1 ? Array.from({ length: count }, (_, index) => index + 1) : [];
  });

  // The slots are listed for a match on a venue eva.gg fills, once its day is
  // known; the hours are typed by hand again when they cannot be read
  const showSlotPicker = computed(() => options.isMatch.value && !!selectedVenue.value?.hasEvaSlots && !!options.date.value);
  const slotStatus = ref<VenueSlotsStatus>('idle');
  const usesSlots = computed(() => showSlotPicker.value && slotStatus.value !== 'unavailable');

  // What the chosen slots were picked for. Moving the day, the venue or the start
  // time leaves them behind, since eva.gg's slots are tied to the three.
  const slotAnchor = ref<{ date: string; venueId: string | null; startTime: string } | null>(null);

  function anchorSlots() {
    slotAnchor.value = evaSlotIds.value.length
      ? { date: options.date.value, venueId: venueId.value, startTime: options.startTime.value }
      : null;
  }

  watch([options.date, venueId, options.startTime], ([newDate, newVenueId, newStartTime]) => {
    const anchor = slotAnchor.value;
    if (!anchor) return;
    if (newDate !== anchor.date || newVenueId !== anchor.venueId || newStartTime !== anchor.startTime) {
      evaSlotIds.value = [];
      slotAnchor.value = null;
    }
  });

  // Playing on slots sets the times the venue runs them on, and the arena when the venue has several
  function applySlots(slots: VenueSlot[]) {
    evaSlotIds.value = slots.map(slot => slot.slotId);
    const first = slots[0];
    const last = slots[slots.length - 1];
    if (first && last) {
      options.startTime.value = first.startTime;
      options.endTime.value = last.endTime;
      if (arenaNumbers.value.length) arenaNumber.value = first.arenaNumber;
    }
    anchorSlots();
  }

  // An arena number only means something in the venue it was picked in. Called
  // from the venue field rather than on any change of venueId, which also
  // changes when the form opens on an event and would then wipe the arena that
  // event is played on.
  function dropArena() {
    arenaNumber.value = null;
  }

  /** Start from a place, the day and hours of the event already set */
  function resetPlace(place: EventPlace) {
    venueId.value = place.venueId;
    arenaNumber.value = place.arenaNumber;
    evaSlotIds.value = place.evaSlotIds;
    anchorSlots();
  }

  return { venueId, arenaNumber, evaSlotIds, arenaNumbers, showSlotPicker, slotStatus, usesSlots, applySlots, dropArena, resetPlace };
}
