// Tests for the home dashboard put in words: what each item is about, its
// subject in the colour code, when it stops being of use, and what to do about
// it, inside the app or on another site
import { describe, it, expect } from 'vitest';
import type { DashboardItem, DashboardMatch } from '@shared/types';
import { dashboardItemKey, describeDashboardItem, describeNext } from '@/utils/dashboard';

// 10:00 in Paris on Monday 10 June 2030
const NOW = new Date('2030-06-10T08:00:00Z');

// The day, the hours and the place of a match, each kept on one line
function line(...parts: string[]): string {
  return parts.map(part => part.replace(/ /g, '\u00a0')).join(' · ');
}

function match(overrides: Partial<DashboardMatch> = {}, due = '2030-06-10T20:00'): DashboardItem {
  return {
    kind: 'MATCH',
    due,
    data: {
      eventId: 'event-1', date: due.slice(0, 10), startTime: due.slice(11), endTime: '21:20', title: 'Match vs Les Rivaux',
      venueName: 'Nîmes', arenaNumber: 2, evaLocationId: 51, headcount: { takenSeats: 6, varies: false }, isUnavailable: false,
      ...overrides,
    },
  };
}

describe('describeDashboardItem', () => {
  it('puts a match of the week in words, with its bookings on eva.gg and where to book a seat', () => {
    const view = describeDashboardItem(match(), NOW);

    expect(view).toMatchObject({
      subject: 'match',
      title: 'Match vs Les Rivaux',
      body: line('lun. 10/06', '20:00 – 21:20', 'Nîmes — arène 2'),
      detail: '6/8 joueurs inscrits sur eva.gg, il en manque 2',
      headcountStatus: 'missing',
      when: 'Aujourd\'hui à 20:00',
      isUrgent: true,
    });
    expect(view.actions).toEqual([
      {
        kind: 'link',
        label: 'Réserver ma place sur eva.gg',
        url: 'https://app.eva.gg/fr-FR/booking/calendar?locationId=51&seatCount=1&gameIds=1&currentDate=2030-06-10',
      },
      { kind: 'route', label: 'Voir le match', to: { path: '/calendar', query: { date: '2030-06-10', mode: 'team', event: 'event-1' } } },
    ]);
  });

  it('says when the slots of a match differ, and nothing of bookings eva.gg could not tell', () => {
    expect(describeDashboardItem(match({ headcount: { takenSeats: 5, varies: true } }), NOW).detail)
      .toBe('5/8 joueurs inscrits sur eva.gg, il en manque 3 sur un des créneaux');
    expect(describeDashboardItem(match({ headcount: { takenSeats: 8, varies: false } }), NOW).detail)
      .toBe('8/8 joueurs inscrits sur eva.gg');
    expect(describeDashboardItem(match({ headcount: null }), NOW)).toMatchObject({ detail: null, headcountStatus: null });
  });

  it('gives the players booked the state they say: a full lineup, players missing, one too many', () => {
    const statusOf = (takenSeats: number) => describeDashboardItem(match({ headcount: { takenSeats, varies: false } }), NOW).headcountStatus;

    expect([statusOf(8), statusOf(5), statusOf(9)]).toEqual(['full', 'missing', 'over']);
  });

  it('offers no seat to book to a player who cannot play that day, and tells them so', () => {
    const view = describeDashboardItem(match({ isUnavailable: true }), NOW);

    expect(view).toMatchObject({ detail: 'Tu t\'es dit indispo ce jour-là.', headcountStatus: null });
    expect(view.actions.map(action => action.label)).toEqual(['Voir le match']);
  });

  it('offers no seat to book at a venue eva.gg does not run', () => {
    expect(describeDashboardItem(match({ evaLocationId: null }), NOW).actions.map(action => action.label)).toEqual(['Voir le match']);
  });

  it('leaves the place out of a match played nowhere yet', () => {
    expect(describeDashboardItem(match({ venueName: null, arenaNumber: null, evaLocationId: null }), NOW).body).toBe(line('lun. 10/06', '20:00 – 21:20'));
  });

  it('is urgent until the end of tomorrow; later, it says in how many days', () => {
    expect(describeDashboardItem(match({}, '2030-06-11T19:20'), NOW)).toMatchObject({ when: 'Demain à 19:20', isUrgent: true });
    expect(describeDashboardItem(match({}, '2030-06-12T19:20'), NOW)).toMatchObject({ when: 'Dans 2 jours', isUrgent: false });
  });

  it('asks for the availability left to give, opening the calendar ready to give it', () => {
    const item: DashboardItem = { kind: 'AVAILABILITY', due: '2030-06-10T00:00', data: { missingDays: 12, horizonDays: 15, firstMissingDate: '2030-06-10' } };

    expect(describeDashboardItem(item, NOW)).toEqual({
      subject: 'dispos',
      title: 'Tes dispos',
      body: 'Tu n\'as pas donné tes dispos pour 12 des 15 prochains jours.',
      detail: 'À commencer par lun. 10/06.',
      headcountStatus: null,
      when: 'Aujourd\'hui',
      isUrgent: true,
      actions: [{ kind: 'route', label: 'Donner mes dispos', to: { path: '/calendar', query: { date: '2030-06-10', mode: 'team', dispos: '1' } } }],
    });
  });

  it('asks to register the team to its league under the name it has there, and to check it once done', () => {
    const item: DashboardItem = {
      kind: 'LEAGUE_REGISTRATION',
      due: '2030-06-30T00:00',
      data: { tournamentId: '2570000000000000100', tournamentName: 'NEMAUSUS LEAGUE - JUILLET', leagueTeamName: 'RONIN', closesAt: '2030-06-29T22:00:00.000Z' },
    };

    expect(describeDashboardItem(item, NOW)).toEqual({
      subject: 'competition',
      title: 'Inscription à la ligue',
      body: 'Inscris RONIN à NEMAUSUS LEAGUE - JUILLET, jusqu\'au sam. 29/06.',
      detail: 'L\'inscription se fait sur competitive.eva.gg.',
      headcountStatus: null,
      when: 'Dans 20 jours',
      isUrgent: false,
      actions: [
        { kind: 'link', label: 'S\'inscrire sur competitive.eva.gg', url: 'https://competitive.eva.gg/fr/tournaments/2570000000000000100/registration' },
        { kind: 'checkLeague', label: 'C\'est fait, vérifier' },
      ],
    });
  });

  it('leads to the search a match was proposed on, to answer it', () => {
    const item: DashboardItem = {
      kind: 'SCRIM_PROPOSAL',
      due: '2030-06-14T20:00',
      data: {
        proposalId: 'proposal-1', searchId: 'search-1', teamId: 'rivals', teamName: 'Les Rivaux', date: '2030-06-14',
        startTime: '20:00', endTime: '21:20', venueId: 'nimes', venueName: 'Nîmes', arenaNumber: 1,
      },
    };

    expect(describeDashboardItem(item, NOW)).toEqual({
      subject: 'matchmaking',
      title: 'Les Rivaux propose un match',
      body: line('ven. 14/06', '20:00 – 21:20', 'Nîmes — arène 1'),
      detail: null,
      headcountStatus: null,
      when: 'Dans 4 jours',
      isUrgent: false,
      actions: [{
        kind: 'route',
        label: 'Répondre',
        to: { path: '/calendar', query: { date: '2030-06-14', mode: 'matchmaking', venue: 'nimes', search: 'search-1' } },
      }],
    });
  });

  it('offers a competition of the venue to add to the calendar, or to refuse', () => {
    const offer = (division: number | null, description: string | null = null): DashboardItem => ({
      kind: 'COMPETITION_OFFER',
      due: '2030-06-15T14:00',
      data: { competitionId: 'c1', venueName: 'Nîmes', division, title: 'Journée de la Division 2', date: '2030-06-15', startTime: '14:00', endTime: '19:00', description },
    });

    expect(describeDashboardItem(offer(2), NOW)).toEqual({
      subject: 'competition',
      title: 'Journée de la Division 2',
      body: line('sam. 15/06', '14:00 – 19:00', 'Nîmes'),
      detail: 'La salle publie la journée de ta division, la Division 2.',
      headcountStatus: null,
      when: 'Dans 5 jours',
      isUrgent: false,
      actions: [
        { kind: 'answerCompetition', label: 'Ajouter au calendrier', answer: 'accept' },
        { kind: 'answerCompetition', label: 'Refuser', answer: 'refuse' },
      ],
    });
    expect(describeDashboardItem(offer(null), NOW).detail).toBe('Un tournoi de la salle.');
    expect(describeDashboardItem(offer(2, 'Convocation 13:30'), NOW).detail).toBe('Convocation 13:30');
  });

  it('puts a competition of the week in words, the venue that published it, and leads to it in the calendar', () => {
    const item: DashboardItem = {
      kind: 'COMPETITION',
      due: '2030-06-12T14:00',
      data: {
        eventId: 'event-5', date: '2030-06-12', startTime: '14:00', endTime: '19:00', title: 'Journée de la Division 2',
        venueName: 'Nîmes', isUnavailable: false,
      },
    };

    expect(describeDashboardItem(item, NOW)).toEqual({
      subject: 'competition',
      title: 'Journée de la Division 2',
      body: line('mer. 12/06', '14:00 – 19:00', 'Nîmes'),
      detail: null,
      headcountStatus: null,
      when: 'Dans 2 jours',
      isUrgent: false,
      actions: [{
        kind: 'route',
        label: 'Voir la compétition',
        to: { path: '/calendar', query: { date: '2030-06-12', mode: 'team', event: 'event-5' } },
      }],
    });
    expect(describeDashboardItem({ ...item, data: { ...item.data, venueName: null, isUnavailable: true } }, NOW)).toMatchObject({
      body: line('mer. 12/06', '14:00 – 19:00'),
      detail: 'Tu t\'es dit indispo ce jour-là.',
    });
  });

  it('counts the players waiting to join, with no due', () => {
    const one = describeDashboardItem({ kind: 'JOIN_REQUESTS', due: null, data: { count: 1 } }, NOW);
    const two = describeDashboardItem({ kind: 'JOIN_REQUESTS', due: null, data: { count: 2 } }, NOW);

    expect(one).toMatchObject({ subject: 'team', body: '1 joueur attend une réponse pour rejoindre l\'équipe.', when: null, isUrgent: false });
    expect(two.body).toBe('2 joueurs attendent une réponse pour rejoindre l\'équipe.');
    expect(two.actions).toEqual([{ kind: 'route', label: 'Voir les demandes', to: { path: '/team' } }]);
  });
});

describe('dashboardItemKey', () => {
  it('tells every item apart, whatever their words', () => {
    const items: DashboardItem[] = [
      match(),
      match({ eventId: 'event-2' }),
      { kind: 'AVAILABILITY', due: '2030-06-10T00:00', data: { missingDays: 1, horizonDays: 15, firstMissingDate: '2030-06-10' } },
      { kind: 'JOIN_REQUESTS', due: null, data: { count: 1 } },
    ];

    expect(new Set(items.map(dashboardItemKey)).size).toBe(items.length);
  });
});

describe('describeNext', () => {
  it('says how far the team\'s next match is, what and when, and leads to it', () => {
    expect(describeNext({ eventId: 'event-9', type: 'MATCH', date: '2030-06-18', startTime: '20:00', title: 'Match vs Les Rivaux' }, NOW)).toEqual({
      lead: 'Prochain match dans 8 jours :',
      label: 'Match vs Les Rivaux, mar. 18/06 à 20:00',
      subject: 'match',
      to: { path: '/calendar', query: { date: '2030-06-18', mode: 'team', event: 'event-9' } },
    });
  });

  it('says a competition when the next is one, in its colour', () => {
    expect(describeNext({ eventId: 'event-7', type: 'COMPETITION', date: '2030-06-11', startTime: '14:00', title: 'Tournoi 2v2' }, NOW))
      .toMatchObject({ lead: 'Prochaine compétition dans 1 jour :', label: 'Tournoi 2v2, mar. 11/06 à 14:00', subject: 'competition' });
  });
});
