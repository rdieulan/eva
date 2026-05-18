// Venues service - business logic

import { prisma } from '@db/prisma';
import type { Venue } from '@shared/types';

const PUBLIC_VENUE_SELECT = {
  id: true,
  name: true,
  city: true,
  address: true,
  phone: true,
} as const;

export interface VenueInput {
  name: string;
  city: string;
  address: string;
  phone?: string | null;
}

// ============================================
// Read
// ============================================

/**
 * Get all venues (public list)
 */
export async function getAllVenues(): Promise<Venue[]> {
  return prisma.venue.findMany({
    select: PUBLIC_VENUE_SELECT,
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
    select: PUBLIC_VENUE_SELECT,
  });
}

// ============================================
// Admin: write
// ============================================

/**
 * Create a venue
 */
export async function createVenue(input: VenueInput): Promise<Venue> {
  return prisma.venue.create({
    data: {
      name: input.name.trim(),
      city: input.city.trim(),
      address: input.address.trim(),
      phone: input.phone?.trim() || null,
    },
    select: PUBLIC_VENUE_SELECT,
  });
}

/**
 * Update a venue. Returns null if the venue does not exist.
 */
export async function updateVenue(venueId: string, input: Partial<VenueInput>): Promise<Venue | null> {
  const existing = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
  if (!existing) return null;

  return prisma.venue.update({
    where: { id: venueId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.city !== undefined && { city: input.city.trim() }),
      ...(input.address !== undefined && { address: input.address.trim() }),
      ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
    },
    select: PUBLIC_VENUE_SELECT,
  });
}

/**
 * Delete a venue. Cascades to VenueManager via Prisma. Sets Team.venueId to null
 * on affiliated teams (no schema-level cascade, handled here).
 * Returns true if deleted, false if not found.
 */
export async function deleteVenue(venueId: string): Promise<boolean> {
  const existing = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
  if (!existing) return false;

  await prisma.$transaction([
    prisma.team.updateMany({ where: { venueId }, data: { venueId: null } }),
    prisma.venue.delete({ where: { id: venueId } }),
  ]);

  return true;
}
