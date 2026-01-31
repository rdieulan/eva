// Venues service - business logic

import { prisma } from '@db/prisma';
import type { Venue } from '@shared/types';

// ============================================
// Public functions
// ============================================

/**
 * Get all venues (public list)
 */
export async function getAllVenues(): Promise<Venue[]> {
  return prisma.venue.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
      phone: true,
    },
    orderBy: [
      { city: 'asc' },
      { name: 'asc' },
    ],
  });
}

/**
 * Get a venue by ID
 */
export async function getVenueById(venueId: string): Promise<Venue | null> {
  return prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
      phone: true,
    },
  });
}
