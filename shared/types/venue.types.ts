// Venue types

/**
 * Public venue data (visible by all authenticated users)
 */
export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  arenaCount: number; // Arenas available for play, numbered 1 to arenaCount
  hasEvaSlots: boolean; // Filled from eva.gg, so its slots can be listed per day
}

// One slot of a venue on a given day: one arena, one start time
export interface VenueSlot {
  slotId: string;          // Opaque eva.gg id, the one bookings carry
  startTime: string;       // HH:mm, when play starts
  endTime: string;         // HH:mm
  convocationTime: string; // HH:mm, when players are expected; what eva.gg shows them
  arenaNumber: number;
  takenSeats: number; // Players already booked on the slot
  totalSeats: number; // Capacity of the slot as eva.gg opened it
}
