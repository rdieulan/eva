// Tests for notifications put in words: one wording and one target per kind, whatever the medium
import { describe, it, expect } from 'vitest';
import {
  buildEvaBookingUrl,
  describeNotification,
  describeProposalDecline,
  formatShortDay,
  formatVenuePlace,
  notificationTargetPath,
} from '@shared/utils';
import { SCRIM_DECLINE_REASONS, type ScrimDeclineReason, type ScrimMatchFacts } from '@shared/types';

const FACTS: ScrimMatchFacts = {
  date: '2026-11-25', startTime: '19:20', endTime: '20:40', venueId: 'venue-nimes', venueName: 'Nîmes', arenaNumber: 1,
};
const MATCH_LINE = 'Les Rivaux · mer. 25/11 · 19:20 – 20:40 · Nîmes — arène 1';
// The same words in pieces, for a card
const PIECES = { who: { name: 'Les Rivaux', teamId: null }, when: 'mer. 25/11 · 19:20 – 20:40', where: 'Nîmes — arène 1' };

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
  it('tells a proposal received, with its message, and opens our search to answer it', () => {
    const description = describeNotification({
      kind: 'SCRIM_PROPOSAL_RECEIVED',
      data: { ...FACTS, searchId: 'search-1', teamName: 'Les Rivaux', teamId: 'team-rivaux', message: 'On est chauds' },
    });

    expect(description).toEqual({
      title: 'Match proposé',
      body: MATCH_LINE,
      ...PIECES,
      who: { name: 'Les Rivaux', teamId: 'team-rivaux' },
      detail: '« On est chauds »',
      quote: 'On est chauds',
      target: { page: 'calendar', date: '2026-11-25', mode: 'matchmaking', open: { kind: 'scrimSearch', id: 'search-1' } },
      action: 'Répondre',
      elsewhere: null,
    });
    expect(describeNotification({
      kind: 'SCRIM_PROPOSAL_RECEIVED',
      data: { ...FACTS, arenaNumber: null, searchId: 'search-1', teamName: 'Les Rivaux', message: null },
    })).toMatchObject({ body: 'Les Rivaux · mer. 25/11 · 19:20 – 20:40 · Nîmes', where: 'Nîmes', detail: null, quote: null, who: { teamId: null } });
  });

  it('tells a match made, opens the team\'s copy, and leads to booking a seat on eva.gg', () => {
    const made = (evaLocationId?: number | null) => describeNotification({
      kind: 'SCRIM_MATCH_MADE',
      data: { ...FACTS, evaLocationId, eventId: 'event-1', opponentName: 'Les Rivaux' },
    });

    expect(made(51)).toEqual({
      title: 'Match calé',
      body: MATCH_LINE,
      ...PIECES,
      detail: 'Chacun réserve sa place sur eva.gg.',
      quote: null,
      target: { page: 'calendar', date: '2026-11-25', mode: 'team', open: { kind: 'event', id: 'event-1' } },
      action: 'Voir le match',
      elsewhere: { label: 'Réserver ma place sur eva.gg', url: buildEvaBookingUrl(51, '2026-11-25') },
    });
    // A venue eva.gg does not run, or a notification told before the venue was kept: nowhere to book
    expect(made(null).elsewhere).toBeNull();
    expect(made(undefined).elsewhere).toBeNull();
  });

  it('tells what became of a declined proposal and why, and opens their search in its venue to propose again', () => {
    const declined = (reason: ScrimDeclineReason) => describeNotification({
      kind: 'SCRIM_PROPOSAL_DECLINED',
      data: { ...FACTS, searchId: 'search-1', teamName: 'Les Rivaux', reason },
    });

    expect(declined('BY_TEAM')).toEqual({
      title: 'Proposition refusée',
      body: MATCH_LINE,
      ...PIECES,
      detail: 'Leur équipe a dit non.',
      quote: null,
      target: { page: 'calendar', date: '2026-11-25', mode: 'matchmaking', venueId: 'venue-nimes', open: { kind: 'scrimSearch', id: 'search-1' } },
      action: 'Voir leur recherche',
      elsewhere: null,
    });
    // Nobody refused a run booked meanwhile: the words of the sheet of their search
    expect(declined('RUN_TAKEN')).toMatchObject({
      title: 'Proposition annulée',
      detail: 'Un des créneaux a été réservé à la salle entre-temps.',
    });
    for (const reason of SCRIM_DECLINE_REASONS) {
      const { title, detail } = describeProposalDecline(reason);
      expect(declined(reason)).toMatchObject({ title, body: MATCH_LINE, detail });
    }
  });

  it('tells a search withdrawn, and shows the market of its venue that day', () => {
    expect(describeNotification({ kind: 'SCRIM_SEARCH_WITHDRAWN', data: { ...FACTS, teamName: 'Les Rivaux' } })).toEqual({
      title: 'Recherche retirée',
      body: MATCH_LINE,
      ...PIECES,
      detail: 'Votre proposition tombe avec elle.',
      quote: null,
      target: { page: 'calendar', date: '2026-11-25', mode: 'matchmaking', venueId: 'venue-nimes' },
      action: 'Voir les autres recherches',
      elsewhere: null,
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
      ...PIECES,
      detail: 'Annulé par leur équipe. Les réservations faites sur eva.gg sont à annuler là-bas.',
      quote: null,
      target: { page: 'calendar', date: '2026-11-25', mode: 'team' },
      action: 'Ouvrir le calendrier',
      elsewhere: null,
    });
    expect(cancelled(false).detail).toBe('Annulé par votre équipe. Les réservations faites sur eva.gg sont à annuler là-bas.');
  });

  it('tells a search closed with no match, and leads to its day to open another', () => {
    expect(describeNotification({ kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId: 'search-1', date: '2026-11-25' } })).toEqual({
      title: 'Recherche close sans match',
      body: 'Votre recherche du mer. 25/11',
      who: null,
      when: 'mer. 25/11',
      where: null,
      detail: 'Ses créneaux ont été réservés à la salle : il n\'en reste plus pour un match.',
      quote: null,
      target: { page: 'calendar', date: '2026-11-25', mode: 'matchmaking' },
      action: 'Ouvrir le calendrier',
      elsewhere: null,
    });
  });

  it('tells who asks to join the team, with their eva.gg account, and leads to the team page to answer', () => {
    const data = { requestId: 'request-1', playerName: 'Raph', evaUsername: 'RONxSib#177352' };

    expect(describeNotification({ kind: 'TEAM_JOIN_REQUESTED', data })).toEqual({
      title: 'Demande pour rejoindre l\'équipe',
      body: 'Raph',
      who: { name: 'Raph', teamId: null },
      when: null,
      where: null,
      detail: 'Compte eva.gg : RONxSib#177352',
      quote: null,
      target: { page: 'team' },
      action: 'Répondre',
      elsewhere: null,
    });
    expect(describeNotification({ kind: 'TEAM_JOIN_REQUESTED', data: { ...data, evaUsername: null } }).detail).toBe('Pas de compte eva.gg relié');
  });
});

describe('describeNotification, the league', () => {
  const facts = { tournamentId: '2570489683180220415', tournamentName: 'NEMAUSUS LEAGUE - DÉCEMBRE', closesAt: '2026-12-30T23:00:00.000Z' };
  const registering = { label: 'S\'inscrire sur competitive.eva.gg', url: 'https://competitive.eva.gg/fr/tournaments/2570489683180220415/registration' };

  it('tells a month of the league open to registration, until when, and where to register', () => {
    expect(describeNotification({ kind: 'LEAGUE_REGISTRATION_OPEN', data: facts })).toEqual({
      title: 'Inscriptions ouvertes à la ligue',
      body: 'NEMAUSUS LEAGUE - DÉCEMBRE · jusqu\'au mer. 30/12',
      who: { name: 'NEMAUSUS LEAGUE - DÉCEMBRE', teamId: null },
      when: 'Jusqu\'au mer. 30/12',
      where: null,
      detail: 'L\'équipe n\'y est pas encore inscrite.',
      quote: null,
      target: { page: 'team' },
      action: 'Voir l\'équipe',
      elsewhere: registering,
    });
  });

  it('tells the last reminder, the team still not registered', () => {
    expect(describeNotification({ kind: 'LEAGUE_REGISTRATION_CLOSING', data: facts })).toMatchObject({
      title: 'Inscription à la ligue : dernier rappel',
      detail: 'L\'équipe n\'y est toujours pas inscrite.',
      elsewhere: registering,
    });
  });
});

describe('notificationTargetPath', () => {
  it('leads to a day of the calendar, or to the team page', () => {
    expect(notificationTargetPath({ page: 'calendar', date: '2026-11-25', mode: 'team' })).toBe('/calendar?date=2026-11-25&mode=team');
    expect(notificationTargetPath({ page: 'team' })).toBe('/team');
  });
});
