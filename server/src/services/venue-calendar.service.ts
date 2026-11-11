// The calendar of a venue, as its manager reads it: the competitions and the
// events it publishes, and the matches teams play there on eva.gg slots, the
// matchmaking's as well as those a team entered by hand. A match entered by
// hand is taken on trust: its players may have booked its slots beforehand,
// slots they then hold themselves, and eva.gg does not say who holds a slot.

import { prisma } from '@db/prisma';
import type { VenueCalendarItem, VenueMatchView } from '@shared/types';
import { logoUrlOf } from '@services/teams.service';
import { venueCompetitionsBetween } from '@services/venue-competitions.service';
import { venueEventsBetween } from '@services/venue-events.service';
import { formatDateStr, parseMonthRange } from './helpers/date.helper';

const MATCH_SELECT = {
  id: true, date: true, startTime: true, endTime: true, title: true, arenaNumber: true, evaSlotIds: true, scrimSearchId: true,
  team: { select: { id: true, name: true, logoType: true, logoUpdatedAt: true } },
} as const;

type MatchRow = {
  id: string; date: Date; startTime: string; endTime: string; title: string; arenaNumber: number | null;
  evaSlotIds: string[]; scrimSearchId: string | null;
  team: { id: string; name: string; logoType: string | null; logoUpdatedAt: Date | null } | null;
};

// A match is its slots: one arena at given hours of a day hosts one match, so
// the events of two teams on the same slots are the same match, whether the
// matchmaking made it, both sides at once, or each team entered it by hand
function matchKey(row: MatchRow): string {
  return `${formatDateStr(row.date)}|${[...row.evaSlotIds].sort().join(',')}`;
}

function toMatch(rows: MatchRow[]): VenueMatchView {
  const first = rows[0]!;
  const teams = [...new Map(rows.flatMap(row => (row.team ? [[row.team.id, row.team] as const] : []))).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(team => ({ id: team.id, name: team.name, logoUrl: logoUrlOf(team) }));
  // Both sides known, the match is theirs; one only, its own words tell the opponent
  const title = teams.length > 1
    ? teams.map(team => team.name).join(' vs ')
    : [teams[0]?.name, first.title].filter(Boolean).join(' · ');
  return {
    id: first.id,
    date: formatDateStr(first.date),
    startTime: first.startTime,
    endTime: first.endTime,
    title,
    arenaNumber: first.arenaNumber,
    slotCount: first.evaSlotIds.length,
    teams,
    fromMatchmaking: rows.some(row => row.scrimSearchId !== null),
  };
}

/** The matches played in a venue between two days, on eva.gg slots, once each */
export async function venueMatchesBetween(venueId: string, from: Date, to: Date): Promise<VenueMatchView[]> {
  const rows = await prisma.calendarEvent.findMany({
    where: { venueId, type: 'MATCH', date: { gte: from, lte: to }, NOT: { evaSlotIds: { isEmpty: true } } },
    select: MATCH_SELECT,
    // The first team to enter a match names it
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const matches = new Map<string, MatchRow[]>();
  for (const row of rows) {
    const key = matchKey(row);
    matches.set(key, [...(matches.get(key) ?? []), row]);
  }
  return [...matches.values()].map(toMatch);
}

/**
 * A month of a venue's calendar (YYYY-MM): its competitions, its events and
 * the matches played there, by day and hour
 */
export async function venueCalendarMonth(venueId: string, month: string): Promise<VenueCalendarItem[]> {
  const { startDate, endDate } = parseMonthRange(month);
  const [competitions, events, matches] = await Promise.all([
    venueCompetitionsBetween(venueId, startDate, endDate),
    venueEventsBetween(venueId, startDate, endDate),
    venueMatchesBetween(venueId, startDate, endDate),
  ]);
  const items: VenueCalendarItem[] = [
    ...competitions.map(competition => ({ ...competition, type: 'COMPETITION' as const })),
    ...events.map(event => ({ ...event, type: 'EVENT' as const })),
    ...matches.map(match => ({ ...match, type: 'MATCH' as const })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}
