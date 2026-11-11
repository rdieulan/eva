// The settings of a venue, as its manager reads them: its public information,
// as eva.gg publishes it, read again on eva.gg at the manager's asking, and
// whether the channel of its own Discord is linked

import { prisma } from '@db/prisma';
import { ERROR } from '@shared/constants';
import type { VenueSettings } from '@shared/types';
import { EVA_VENUES_COUNTRY, fetchEvaLocations, toVenues } from '../integrations/eva/eva-locations';
import { discordChannelStatus } from '@services/discord-channel.service';
import { logger } from '@utils/logger';

// The least time between two reads of a venue on eva.gg, whatever came of the one before
export const VENUE_REFRESH_PAUSE_MS = 5 * 60 * 1000;

// When each venue was last read on eva.gg at its manager's asking
const refreshedAt = new Map<string, number>();

const SETTINGS_SELECT = {
  id: true, name: true, city: true, address: true, phone: true, arenaCount: true, externalId: true,
  website: true, discord: true, facebook: true, instagram: true, x: true, tiktok: true, youtube: true, twitch: true,
} as const;

/** A venue's settings; null when there is no such venue */
export async function getVenueSettings(venueId: string): Promise<VenueSettings | null> {
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: SETTINGS_SELECT });
  if (!venue) return null;
  const { externalId, ...publicInformation } = venue;
  return { ...publicInformation, isFromEva: externalId !== null, discordChannel: await discordChannelStatus('venue', venueId) };
}

/**
 * Read a venue again on eva.gg, as the sync of the venues does, for its
 * manager to see at once what they changed there. Only a venue eva.gg lists;
 * once every five minutes at most per venue, whatever came of the read before.
 * eva.gg lists the venues of a country at once: one call reads them all.
 */
export async function refreshVenueFromEva(venueId: string, now: Date = new Date()): Promise<{ error: string } | VenueSettings> {
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { externalId: true } });
  if (!venue) return { error: ERROR.venueNotFound };
  if (venue.externalId === null) return { error: ERROR.venueNotFromEva };

  const last = refreshedAt.get(venueId);
  if (last !== undefined && now.getTime() - last < VENUE_REFRESH_PAUSE_MS) return { error: ERROR.venueRefreshTooSoon };
  refreshedAt.set(venueId, now.getTime());

  let listed;
  try {
    listed = toVenues(await fetchEvaLocations(EVA_VENUES_COUNTRY)).venues;
  } catch (error) {
    logger.warn(`Venue settings: eva.gg could not answer for venue ${venueId}`, error);
    return { error: ERROR.venueRefreshFailed };
  }
  const fresh = listed.find(candidate => candidate.externalId === venue.externalId);
  if (!fresh) return { error: ERROR.venueGoneFromEva };

  // What the sync of the venues writes: the location's id stays the same
  await prisma.venue.update({ where: { id: venueId }, data: fresh, select: { id: true } });
  return (await getVenueSettings(venueId))!;
}
