// Scrim display and selection helpers

import type { ScrimSearch } from '@shared/types';
import { EVA_SLOT_DURATION_MINUTES } from '@shared/constants';
import { orderRunSlots, runSpan, slotStreaks, spansOverlap, type RunSlot } from '@shared/utils';

/**
 * The time a number of slots adds up to: "40 min", "1h20", "2h"
 */
export function formatSlotsDuration(slotCount: number): string {
  const minutes = slotCount * EVA_SLOT_DURATION_MINUTES;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

/**
 * A match length in slots, with the time it adds up to: "2 créneaux (1h20)"
 */
export function formatSlotCount(slotCount: number): string {
  const count = slotCount > 1 ? `${slotCount} créneaux` : '1 créneau';
  return `${count} (${formatSlotsDuration(slotCount)})`;
}

/**
 * How many matches, in words: "1 match", "3 matchs"
 */
export function formatMatchCount(matchCount: number): string {
  return matchCount > 1 ? `${matchCount} matchs` : `${matchCount} match`;
}

/**
 * The slots that still make whole matches of `length` slots: a slot left
 * without enough neighbours in a row, on its arena, goes.
 */
export function keepWholeMatches<T extends RunSlot>(slots: T[], length: number): T[] {
  return slotStreaks(orderRunSlots(slots)).filter(streak => streak.length >= length).flat();
}

/**
 * The proposals waiting for an answer on a search of ours
 */
export function pendingProposalCount(search: Pick<ScrimSearch, 'proposals'>): number {
  return search.proposals.filter(proposal => proposal.status === 'PENDING').length;
}

/**
 * Our own search in words, for the mark that shows it without any:
 * "Notre recherche · 16:40 – 22:00 · 2 équipes ont proposé un match"
 */
export function ownSearchLabel(search: Pick<ScrimSearch, 'proposals' | 'startTime' | 'endTime'>): string {
  const hours = `Notre recherche · ${search.startTime} – ${search.endTime}`;
  const pending = pendingProposalCount(search);
  if (!pending) return hours;
  return pending > 1 ? `${hours} · ${pending} équipes ont proposé un match` : `${hours} · Une équipe a proposé un match`;
}

/**
 * The venues a search offers slots in, in the order the team gave them
 */
export function searchVenueIds(search: Pick<ScrimSearch, 'slots'>): string[] {
  return [...new Set(search.slots.map(slot => slot.venueId))];
}

// A stretch of the day, as the clock reads it
export interface ClockStretch {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

/**
 * The stretches of the day slots cover, arenas taken together: slots that
 * touch or overlap make one stretch. In the order of the day.
 */
export function coveredStretches(slots: { startTime: string; endTime: string }[]): ClockStretch[] {
  const ordered = [...slots].sort((a, b) => runSpan(a).start - runSpan(b).start);
  const stretches: Array<ClockStretch & { end: number }> = [];
  for (const slot of ordered) {
    const span = runSpan(slot);
    const last = stretches[stretches.length - 1];
    if (last && span.start <= last.end) {
      if (span.end > last.end) Object.assign(last, { endTime: slot.endTime, end: span.end });
    } else {
      stretches.push({ startTime: slot.startTime, endTime: slot.endTime, end: span.end });
    }
  }
  return stretches.map(({ startTime, endTime }) => ({ startTime, endTime }));
}

/**
 * Where another team's search meets the slots picked for ours: each venue of
 * the search where picked slots fall at hours it still offers, with the
 * stretches it offers there. What a match already made took is left out, and
 * what is too short for a match of its length too. Empty when they never meet.
 */
export function searchOverlap(
  search: Pick<ScrimSearch, 'slots' | 'takenSlotIds' | 'slotCount'>,
  picked: { venueId: string; startTime: string; endTime: string }[],
): { venueId: string; stretches: ClockStretch[] }[] {
  const taken = new Set(search.takenSlotIds);
  const offered = keepWholeMatches(search.slots.filter(slot => !taken.has(slot.slotId)), search.slotCount);
  return searchVenueIds(search).flatMap(venueId => {
    const theirs = offered.filter(slot => slot.venueId === venueId);
    const ours = picked.filter(slot => slot.venueId === venueId);
    const meets = theirs.some(slot => ours.some(pick => spansOverlap(runSpan(slot), runSpan(pick))));
    return meets ? [{ venueId, stretches: coveredStretches(theirs) }] : [];
  });
}
