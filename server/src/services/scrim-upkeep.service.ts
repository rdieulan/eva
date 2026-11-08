// Scrim searches kept in step with time: the slots they offer can be booked by
// anyone at the venue after the search opened, and the day of a search passes

import { prisma } from '@db/prisma';
import type { VenueSlot } from '@shared/types';
import { refreshSearchOffer } from '@services/scrim-search.service';
import { getVenueSlots } from '@services/venue-slots.service';
import { formatDateStr } from './helpers/date.helper';
import { logger } from '../utils/logger';

// How often the open searches are checked against eva.gg
export const SCRIM_UPKEEP_INTERVAL_MS = 60 * 60 * 1000;

// Between two reads of eva.gg: the check never comes as a burst
export const SCRIM_UPKEEP_READ_PAUSE_MS = 1000;

export type ScrimUpkeepReport = {
  closedPast: number;  // Searches whose day passed, closed
  daysRead: number;    // Venue days read from eva.gg
  daysFailed: number;  // Venue days eva.gg could not give: their searches kept as they were
  slotsLost: number;   // Offered slots no longer open to a match, taken out
  closedLost: number;  // Searches closed for holding no match any more
};

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * One pass over the open searches. Those whose day passed close, their
 * pending proposals declined: as matched when they made some, as expired
 * otherwise. The others are checked against eva.gg, one read for each venue
 * and day they offer slots in, whatever the number of searches there, a pause
 * between two reads (see refreshSearchOffer for what a check does). A venue
 * day eva.gg cannot give leaves its searches as they were, for the next pass.
 */
export async function upkeepScrimSearches(options: { now?: Date; pauseMs?: number } = {}): Promise<ScrimUpkeepReport> {
  const today = new Date(formatDateStr(options.now ?? new Date()));
  const pauseMs = options.pauseMs ?? SCRIM_UPKEEP_READ_PAUSE_MS;
  const report: ScrimUpkeepReport = { closedPast: 0, daysRead: 0, daysFailed: 0, slotsLost: 0, closedLost: 0 };

  // Days gone by: closed, matched when they made some match
  const past = { status: 'OPEN' as const, date: { lt: today } };
  const matched = await prisma.scrimSearch.updateMany({
    where: { ...past, proposals: { some: { status: 'ACCEPTED' } } },
    data: { status: 'MATCHED' },
  });
  const expired = await prisma.scrimSearch.updateMany({ where: past, data: { status: 'EXPIRED' } });
  report.closedPast = matched.count + expired.count;
  if (report.closedPast) {
    await prisma.scrimProposal.updateMany({
      where: { status: 'PENDING', search: { status: { in: ['MATCHED', 'EXPIRED'] }, date: { lt: today } } },
      data: { status: 'DECLINED', declineReason: 'DAY_PASSED', respondedAt: new Date() },
    });
  }

  // Days to come: each venue day read once
  const searches = await prisma.scrimSearch.findMany({
    where: { status: 'OPEN', date: { gte: today } },
    select: { id: true, date: true, slots: { select: { venueId: true } } },
  });
  const days = new Map<string, VenueSlot[] | null>();
  for (const search of searches) {
    const date = formatDateStr(search.date);
    for (const { venueId } of search.slots) {
      const key = `${venueId}|${date}`;
      if (days.has(key)) continue;
      if (days.size) await pause(pauseMs);
      try {
        const read = await getVenueSlots(venueId, date);
        days.set(key, 'slots' in read ? read.slots : null);
        if ('slots' in read) report.daysRead += 1;
        else report.daysFailed += 1;
      } catch (error) {
        days.set(key, null);
        report.daysFailed += 1;
        logger.warn(`Scrim upkeep: eva.gg could not give the slots of venue ${venueId} on ${date}`, error);
      }
    }
  }

  for (const search of searches) {
    const date = formatDateStr(search.date);
    const refreshed = await refreshSearchOffer(search.id, venueId => days.get(`${venueId}|${date}`) ?? null);
    report.slotsLost += refreshed.lost;
    if (refreshed.closed) report.closedLost += 1;
  }

  return report;
}

/**
 * Check the open searches every hour, the first time an hour after the server
 * starts: a server restarted again and again while it is worked on never sends
 * eva.gg a read at each start
 */
export function startScrimUpkeep(): void {
  setInterval(() => {
    upkeepScrimSearches()
      .then(report => logger.info('Scrim upkeep', report))
      .catch(error => logger.error('Scrim upkeep failed', error));
  }, SCRIM_UPKEEP_INTERVAL_MS);
}
