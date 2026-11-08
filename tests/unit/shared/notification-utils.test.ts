// Tests for notifications put in words: one wording and one target per kind, whatever the medium
import { describe, it, expect } from 'vitest';
import { describeNotification, formatShortDay, formatVenuePlace } from '@shared/utils';
import type { ScrimMatchFacts } from '@shared/types';

const FACTS: ScrimMatchFacts = {
  date: '2026-11-25', startTime: '19:20', endTime: '20:40', venueId: 'venue-nimes', venueName: 'Nîmes', arenaNumber: 1,
};
const MATCH_LINE = 'Les Rivaux · mer. 25/11 · 19:20 – 20:40 · Nîmes — arène 1';

describe('formatShortDay', () => {
  it('names the weekday and the day of the month, whatever the timezone', () => {
    expect(formatShortDay('2026-11-25')).toBe('mer. 25/11');
    expect(formatShortDay('2026-03-01')).toBe('dim. 01/03');
    expect(formatShortDay('2027-01-04')).toBe('lun. 04/01');
  });
});

describe('formatVenuePlace', () => {
  it('names the arena only when there is one to name', () => {
    expect(formatVenuePlace('Nîmes', 2)).toBe('Nîmes — arène 2');
    expect(formatVenuePlace('Montpellier', null)).toBe('Montpellier');
    expect(formatVenuePlace('Montpellier', undefined)).toBe('Montpellier');
  });
});

describe('describeNotification', () => {
  it('tells a proposal received, with its message, and opens our search', () => {
    const description = describeNotification({
      kind: 'SCRIM_PROPOSAL_RECEIVED',
      data: { ...FACTS, searchId: 'search-1', teamName: 'Les Rivaux', message: 'On est chauds' },
    });

    expect(description).toEqual({
      title: 'Match proposé',
      body: MATCH_LINE,
      detail: '« On est chauds »',
      target: { page: 'calendar', date: '2026-11-25', mode: 'matchmaking', open: { kind: 'scrimSearch', id: 'search-1' } },
    });
    expect(describeNotification({
      kind: 'SCRIM_PROPOSAL_RECEIVED',
      data: { ...FACTS, arenaNumber: null, searchId: 'search-1', teamName: 'Les Rivaux', message: null },
    })).toMatchObject({ body: 'Les Rivaux · mer. 25/11 · 19:20 – 20:40 · Nîmes', detail: null });
  });

  it('tells a match made, and opens the team\'s copy in the team calendar', () => {
    expect(describeNotification({ kind: 'SCRIM_MATCH_MADE', data: { ...FACTS, eventId: 'event-1', opponentName: 'Les Rivaux' } })).toEqual({
      title: 'Match calé',
      body: MATCH_LINE,
      detail: 'Chacun réserve sa place sur eva.gg.',
      target: { page: 'calendar', date: '2026-11-25', mode: 'team', open: { kind: 'event', id: 'event-1' } },
    });
  });

  it('tells why a proposal fell, and opens their search in its venue to propose again', () => {
    const declined = (reason: 'byTeam' | 'timeTaken' | 'searchClosed' | 'runTaken' | 'searchChanged') => describeNotification({
      kind: 'SCRIM_PROPOSAL_DECLINED',
      data: { ...FACTS, searchId: 'search-1', teamName: 'Les Rivaux', reason },
    });

    expect(declined('byTeam')).toEqual({
      title: 'Proposition refusée',
      body: MATCH_LINE,
      detail: 'Leur équipe a dit non.',
      target: { page: 'calendar', date: '2026-11-25', mode: 'matchmaking', venueId: 'venue-nimes', open: { kind: 'scrimSearch', id: 'search-1' } },
    });
    expect(declined('timeTaken').detail).toBe('Un autre de leurs matchs a pris cette heure.');
    expect(declined('searchClosed').detail).toBe('Leur recherche est close.');
    expect(declined('runTaken').detail).toBe('Un des créneaux a été réservé à la salle entre-temps.');
    expect(declined('searchChanged').detail).toBe('Leur recherche a changé et ne tient plus ce match.');
  });

  it('tells a search withdrawn, and shows the market of its venue that day', () => {
    expect(describeNotification({ kind: 'SCRIM_SEARCH_WITHDRAWN', data: { ...FACTS, teamName: 'Les Rivaux' } })).toEqual({
      title: 'Recherche retirée',
      body: MATCH_LINE,
      detail: 'Votre proposition tombe avec elle.',
      target: { page: 'calendar', date: '2026-11-25', mode: 'matchmaking', venueId: 'venue-nimes' },
    });
  });

  it('tells a match called off, and by which side', () => {
    const cancelled = (byOpponent: boolean) => describeNotification({
      kind: 'SCRIM_MATCH_CANCELLED',
      data: { ...FACTS, opponentName: 'Les Rivaux', byOpponent },
    });

    expect(cancelled(true)).toEqual({
      title: 'Match annulé',
      body: MATCH_LINE,
      detail: 'Annulé par leur équipe. Les réservations faites sur eva.gg sont à annuler là-bas.',
      target: { page: 'calendar', date: '2026-11-25', mode: 'team' },
    });
    expect(cancelled(false).detail).toBe('Annulé par votre équipe. Les réservations faites sur eva.gg sont à annuler là-bas.');
  });

  it('tells a search closed with no match, and leads to its day to open another', () => {
    expect(describeNotification({ kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId: 'search-1', date: '2026-11-25' } })).toEqual({
      title: 'Recherche close sans match',
      body: 'Votre recherche du mer. 25/11',
      detail: 'Ses créneaux ont été réservés à la salle : il n\'en reste plus pour un match.',
      target: { page: 'calendar', date: '2026-11-25', mode: 'matchmaking' },
    });
  });
});
