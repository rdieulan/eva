// Venue slots service - the slots a venue runs on a day, read from eva.gg

import { prisma } from '@db/prisma';
import type { VenueSlot } from '@shared/types';
import { fetchLocationSessions } from '../integrations/eva/eva-sessions';

// A day's slots barely change; this spares eva.gg a call each time a form opens
export const VENUE_SLOTS_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  slots: VenueSlot[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export type VenueSlotsRefusal = 'venueNotFound' | 'venueNotOnEva';

export type VenueSlotsResult = { slots: VenueSlot[] } | { refusal: VenueSlotsRefusal };

/**
 * Forget every cached day (tests)
 */
export function clearVenueSlotsCache(): void {
  cache.clear();
}

/**
 * The slots a venue runs on a date (YYYY-MM-DD), empty when it is closed.
 * Throws an EvaApiError when eva.gg cannot answer.
 */
export async function getVenueSlots(venueId: string, date: string): Promise<VenueSlotsResult> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { externalId: true },
  });
  if (!venue) return { refusal: 'venueNotFound' };
  if (venue.externalId === null) return { refusal: 'venueNotOnEva' };

  const key = `${venue.externalId}:${date}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { slots: cached.slots };

  const sessions = await fetchLocationSessions(venue.externalId, date);
  const slots: VenueSlot[] = sessions.map(session => ({
    slotId: session.slotId,
    startTime: session.startTime,
    endTime: session.endTime,
    convocationTime: session.convocationTime,
    arenaNumber: session.arenaNumber,
    takenSeats: session.takenSeats,
    totalSeats: session.totalSeats,
    isCompetitiveAvailable: session.isCompetitiveAvailable,
  }));

  cache.set(key, { slots, expiresAt: Date.now() + VENUE_SLOTS_CACHE_TTL_MS });
  return { slots };
}
