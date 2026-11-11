// Tests for notifications as Discord cards: the other team, what happened, when and where, their word, what to do,
// coloured as the bell colours them
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { CARD_COLORS, linkedMessage, notificationMessage, venueAnnouncementMessage } from '../../../server/src/services/helpers/discord-message.helper';
import { buildEvaBookingUrl } from '@shared/utils';
import type { ScrimMatchFacts } from '@shared/types';

const FACTS: ScrimMatchFacts = {
  date: '2026-11-25', startTime: '19:20', endTime: '20:40', venueId: 'venue-nimes', venueName: 'Nîmes', arenaNumber: null, evaLocationId: 51,
};
const BASE = 'https://eva.example';
// After an icon, a space wide enough to keep it off its text; between two links, wider still
const GAP = '\u2002';
const LINKS_APART = '\u2003\u2003';
const WHEN_WHERE = `📅${GAP}**mer. 25/11 · 19:20 – 20:40**\n\n📍${GAP}Nîmes`;

describe('notificationMessage', () => {
  it('lays a proposal received out: their team and logo, when and where, their word, then answering', () => {
    const message = notificationMessage({
      kind: 'SCRIM_PROPOSAL_RECEIVED',
      data: { ...FACTS, searchId: 'search-1', teamName: 'Les Rivaux', teamId: 't1', message: 'On est quatre,\ndispo pour un bo3 ?' },
    }, { base: BASE, logo: 'logo.png' });
    const link = `${BASE}/calendar?date=2026-11-25&mode=matchmaking&search=search-1`;

    expect(message.username).toBe('EVA');
    expect(message.embeds).toHaveLength(1);
    expect(message.embeds[0]).toMatchObject({
      author: { name: 'Les Rivaux' },
      title: `🤝${GAP}Match proposé`,
      description: [WHEN_WHERE, '> On est quatre,\n> dispo pour un bo3 ?', `💬${GAP}[Répondre](${link})`].join('\n\n'),
      // The logo goes with the message as a file
      thumbnail: { url: 'attachment://logo.png' },
      color: CARD_COLORS.matchmaking,
      footer: { text: 'EVA · Matchmaking' },
    });
    expect(Date.parse(message.embeds[0]!.timestamp!)).not.toBeNaN();
    // The title is no link: Discord would underline the gap after its icon
    expect(message.embeds[0]).not.toHaveProperty('url');
  });

  it('keeps every icon off its text, and two lines of icons apart', () => {
    const [embed] = notificationMessage({ kind: 'SCRIM_MATCH_MADE', data: { ...FACTS, eventId: 'event-1', opponentName: 'Nova' } }, { base: BASE }).embeds;

    for (const icon of ['✅', '📅', '📍', '🎮', '🎟️']) {
      expect(`${embed!.title}\n${embed!.description}`).toContain(`${icon}${GAP}`);
    }
    expect(embed!.description).not.toMatch(/\*\*\n📍/);
  });

  it('leads a match made to booking a seat on eva.gg, at the right venue on the right day', () => {
    const [embed] = notificationMessage({ kind: 'SCRIM_MATCH_MADE', data: { ...FACTS, eventId: 'event-1', opponentName: 'Nova' } }, { base: BASE }).embeds;

    expect(embed!.title).toBe(`✅${GAP}Match calé`);
    expect(embed!.color).toBe(CARD_COLORS.match);
    expect(embed!.description).toBe([
      WHEN_WHERE,
      'Chacun réserve sa place sur eva.gg.',
      `🎮${GAP}[Voir le match](${BASE}/calendar?date=2026-11-25&mode=team&event=event-1)${LINKS_APART}🎟️${GAP}[Réserver ma place sur eva.gg](${buildEvaBookingUrl(51, '2026-11-25')})`,
    ].join('\n\n'));
    // No logo for the team: no picture
    expect(embed).not.toHaveProperty('thumbnail');
  });

  it('says why a proposal fell, and colours what came to nothing apart from what was refused or called off', () => {
    const declined = notificationMessage({
      kind: 'SCRIM_PROPOSAL_DECLINED', data: { ...FACTS, searchId: 'search-1', teamName: 'Les Faucons', reason: 'RUN_TAKEN' },
    }, { base: BASE }).embeds[0]!;
    const refused = notificationMessage({
      kind: 'SCRIM_PROPOSAL_DECLINED', data: { ...FACTS, searchId: 'search-1', teamName: 'Les Faucons', reason: 'BY_TEAM' },
    }, { base: BASE }).embeds[0]!;
    const cancelled = notificationMessage({ kind: 'SCRIM_MATCH_CANCELLED', data: { ...FACTS, opponentName: 'Nova', byOpponent: true } }, { base: BASE }).embeds[0]!;
    const expired = notificationMessage({ kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId: 'search-1', date: '2026-11-25' } }, { base: BASE }).embeds[0]!;

    expect(declined.title).toBe(`🚫${GAP}Proposition annulée`);
    expect(declined.description).toContain(`\n\nUn des créneaux a été réservé à la salle entre-temps.\n\n🔎${GAP}[Voir leur recherche](`);
    expect(declined.color).toBe(CARD_COLORS.fellThrough);
    expect(expired.color).toBe(CARD_COLORS.fellThrough);
    expect(refused.title).toBe(`🚫${GAP}Proposition refusée`);
    expect(refused.color).toBe(CARD_COLORS.refused);
    expect(cancelled.title).toBe(`❌${GAP}Match annulé`);
    expect(cancelled.description).toContain(`📆${GAP}[Ouvrir le calendrier](`);
    expect(cancelled.color).toBe(CARD_COLORS.refused);
  });

  it('keeps what a team wrote as text: no formatting, no hidden link', () => {
    const [embed] = notificationMessage({
      kind: 'SCRIM_PROPOSAL_RECEIVED',
      data: { ...FACTS, venueName: 'Salle (B)', searchId: 'search-1', teamName: '**Les_Rivaux**', message: 'On joue ? [ici](https://evil.example) #go' },
    }, { base: BASE }).embeds;

    // An author line shows as written: no formatting is read there
    expect(embed!.author).toEqual({ name: '**Les_Rivaux**' });
    expect(embed!.description).toContain(`📍${GAP}Salle \\(B\\)`);
    expect(embed!.description).toContain('> On joue ? \\[ici\\]\\(https://evil.example\\) \\#go');
  });

  it('leaves out the links into the app with no public address for it, but not the way to eva.gg', () => {
    const [received] = notificationMessage({
      kind: 'SCRIM_PROPOSAL_RECEIVED', data: { ...FACTS, searchId: 's', teamName: 'Nova', teamId: 't1', message: null },
    }, { base: null }).embeds;
    const [made] = notificationMessage({ kind: 'SCRIM_MATCH_MADE', data: { ...FACTS, eventId: 'event-1', opponentName: 'Nova' } }, { base: null }).embeds;

    // No logo file sent along: no picture
    expect(received).not.toHaveProperty('thumbnail');
    expect(received!.description).toBe(WHEN_WHERE);
    expect(made!.description!.endsWith(`🎟️${GAP}[Réserver ma place sur eva.gg](${buildEvaBookingUrl(51, '2026-11-25')})`)).toBe(true);
    expect(made!.description).not.toContain('Voir le match');
  });

  it('lays a request to join the team out: who asks, their eva.gg account, then answering on the team page', () => {
    const [embed] = notificationMessage({
      kind: 'TEAM_JOIN_REQUESTED',
      data: { requestId: 'request-1', playerName: 'Raph_42', evaUsername: 'RONxSib#177352' },
    }, { base: BASE }).embeds;

    expect(embed).toMatchObject({
      author: { name: 'Raph_42' },
      title: `🙋${GAP}Demande pour rejoindre l'équipe`,
      // The # escaped, which Discord would read as a heading: it still shows as #
      description: `Compte eva.gg : RONxSib\\#177352\n\n👥${GAP}[Répondre](${BASE}/team)`,
      color: CARD_COLORS.team,
      footer: { text: 'EVA · Équipe' },
    });
  });

  it('lays the last reminder of a league registration out: the month, until when, then the team and the registration page', () => {
    const [embed] = notificationMessage({
      kind: 'LEAGUE_REGISTRATION_CLOSING',
      data: { tournamentId: '2570489683180220415', tournamentName: 'NEMAUSUS LEAGUE - NOVEMBRE', closesAt: '2026-11-29T23:00:00.000Z' },
    }, { base: BASE }).embeds;

    expect(embed).toMatchObject({
      author: { name: 'NEMAUSUS LEAGUE - NOVEMBRE' },
      title: `⏰${GAP}Inscription à la ligue : dernier rappel`,
      description: `📅${GAP}**Jusqu'au dim. 29/11**\n\nL'équipe n'y est toujours pas inscrite.\n\n`
        + `👥${GAP}[Voir l'équipe](${BASE}/team)${LINKS_APART}🎟️${GAP}[S'inscrire sur competitive.eva.gg](https://competitive.eva.gg/fr/tournaments/2570489683180220415/registration)`,
      color: CARD_COLORS.competition,
      footer: { text: 'EVA · Ligue' },
    });
  });

  it('lays a competition offered out: its title, when and where, the venue\'s word, then answering from the home', () => {
    const competition = {
      title: 'Journée de la Division 2', venueName: 'Nîmes', date: '2026-11-28', startTime: '14:00', endTime: '19:00', description: 'Convocation 13:30',
    };
    const [embed] = notificationMessage({ kind: 'COMPETITION_OFFERED', data: competition }, { base: BASE }).embeds;

    expect(embed).toMatchObject({
      author: { name: 'Journée de la Division 2' },
      title: `🏆${GAP}Compétition proposée par la salle`,
      description: `📅${GAP}**sam. 28/11 · 14:00 – 19:00**\n\n📍${GAP}Nîmes\n\n> Convocation 13:30\n\n💬${GAP}[Répondre](${BASE}/)`,
      color: CARD_COLORS.competition,
      footer: { text: 'EVA · Compétition' },
    });

    // Withdrawn from the calendar it was in: called off, in red; before an answer: come to nothing, in grey
    const withdrawn = (accepted: boolean) => notificationMessage({ kind: 'COMPETITION_WITHDRAWN', data: { ...competition, accepted } }, { base: BASE }).embeds[0]!;
    expect(withdrawn(true)).toMatchObject({
      title: `🗑️${GAP}Compétition retirée par la salle`,
      description: `📅${GAP}**sam. 28/11 · 14:00 – 19:00**\n\n📍${GAP}Nîmes\n\nElle quitte le calendrier de l'équipe.\n\n`
        + `📆${GAP}[Ouvrir le calendrier](${BASE}/calendar?date=2026-11-28&mode=team)`,
      color: CARD_COLORS.refused,
    });
    expect(withdrawn(false).color).toBe(CARD_COLORS.fellThrough);
  });

  it('lays an event of the venue withdrawn out: gone from the calendar, in red, from the venue', () => {
    const night = { title: 'Nocturne', venueName: 'Nîmes', date: '2026-11-28', startTime: '21:00', endTime: '23:59', description: 'Ouverte à tous' };
    const [embed] = notificationMessage({ kind: 'VENUE_EVENT_WITHDRAWN', data: night }, { base: BASE }).embeds;

    expect(embed).toMatchObject({
      author: { name: 'Nocturne' },
      title: `🗑️${GAP}Événement retiré par la salle`,
      description: `📅${GAP}**sam. 28/11 · 21:00 – 23:59**\n\n📍${GAP}Nîmes\n\nIl quitte le calendrier de l'équipe.\n\n`
        + `📆${GAP}[Ouvrir le calendrier](${BASE}/calendar?date=2026-11-28&mode=team)`,
      color: CARD_COLORS.refused,
      footer: { text: 'EVA · Salle' },
    });
  });

  it('lays a search closed with no match out with its day alone', () => {
    const [embed] = notificationMessage({ kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId: 'search-1', date: '2026-11-25' } }, { base: BASE }).embeds;

    expect(embed).not.toHaveProperty('author');
    expect(embed!.title).toBe(`⌛${GAP}Recherche close sans match`);
    expect(embed!.description!.startsWith(`📅${GAP}**mer. 25/11**\n\nSes créneaux ont été réservés`)).toBe(true);
  });
});

describe('venueAnnouncementMessage', () => {
  const NIGHT = {
    title: 'Nocturne', venueName: 'Nîmes', date: '2026-11-13', startTime: '21:00', endTime: '23:59', description: 'Ouverte à tous,\n15 € la soirée',
  };

  it('lays an event the venue published out for its public: its title, when, and the venue\'s word', () => {
    const message = venueAnnouncementMessage({ subject: 'event', change: 'published', facts: NIGHT, kind: null });

    expect(message.username).toBe('EVA');
    expect(message.embeds[0]).toMatchObject({
      author: { name: 'Nocturne' },
      title: `📅${GAP}Nouvel événement`,
      description: `📅${GAP}**ven. 13/11 · 21:00 – 23:59**\n\n> Ouverte à tous,\n> 15 € la soirée`,
      color: CARD_COLORS.event,
      footer: { text: 'EVA · Salle' },
    });
  });

  it('tells what a competition is, and a withdrawal in red, without the word on it', () => {
    const day = { ...NIGHT, title: 'Journée de la Division 2', date: '2026-11-28', startTime: '14:00', endTime: '19:00', description: 'Convocation 13:30' };

    expect(venueAnnouncementMessage({ subject: 'competition', change: 'published', facts: day, kind: 'Division 2' }).embeds[0]).toMatchObject({
      title: `🏆${GAP}Nouvelle compétition`,
      description: `📅${GAP}**sam. 28/11 · 14:00 – 19:00**\n\nDivision 2\n\n> Convocation 13:30`,
      color: CARD_COLORS.competition,
    });
    expect(venueAnnouncementMessage({ subject: 'competition', change: 'withdrawn', facts: day, kind: 'Division 2' }).embeds[0]).toMatchObject({
      title: `🗑️${GAP}Compétition annulée`,
      description: `📅${GAP}**sam. 28/11 · 14:00 – 19:00**\n\nDivision 2`,
      color: CARD_COLORS.refused,
    });
    expect(venueAnnouncementMessage({ subject: 'event', change: 'withdrawn', facts: NIGHT, kind: null }).embeds[0]!.title).toBe(`🗑️${GAP}Événement annulé`);
  });

  it('tells a change, with when it was before when its day or hours moved', () => {
    const moved = venueAnnouncementMessage({
      subject: 'event', change: 'changed', facts: { ...NIGHT, startTime: '22:00' }, kind: null,
      before: { date: '2026-11-13', startTime: '21:00', endTime: '23:59' },
    }).embeds[0]!;

    expect(moved).toMatchObject({
      title: `✏️${GAP}Événement modifié`,
      description: `📅${GAP}**ven. 13/11 · 22:00 – 23:59**\n\nAvant : ven. 13/11 · 21:00 – 23:59.\n\n> Ouverte à tous,\n> 15 € la soirée`,
      color: CARD_COLORS.event,
    });
    expect(venueAnnouncementMessage({ subject: 'event', change: 'changed', facts: NIGHT, kind: null, before: null }).embeds[0]!.description)
      .not.toContain('Avant');
  });
});

describe('linkedMessage', () => {
  it('tells the channel just linked what will arrive there: a team\'s notifications, or a venue\'s publications', () => {
    expect(linkedMessage('team', 'Les_Rivaux').embeds[0]).toEqual({
      title: `🔗${GAP}Salon relié`,
      description: 'Les notifications de l\'équipe Les\\_Rivaux arriveront ici.',
      color: CARD_COLORS.good,
      footer: { text: 'EVA · Équipe' },
    });
    expect(linkedMessage('venue', 'Nîmes').embeds[0]).toMatchObject({
      description: 'Les publications de la salle Nîmes arriveront ici.',
      footer: { text: 'EVA · Salle' },
    });
  });
});

describe('CARD_COLORS', () => {
  // The night theme, where the app reads its colours: a card stays the colour the bell shows
  const night = readFileSync(resolve(__dirname, '../../../client/src/styles/themes/_night.scss'), 'utf-8');

  function themeColor(token: string): number {
    const value = new RegExp(`--${token}:\\s*#([0-9a-f]{3}|[0-9a-f]{6});`, 'i').exec(night)?.[1];
    if (!value) throw new Error(`--${token} is not a colour of the night theme`);
    const full = value.length === 3 ? [...value].map(digit => digit + digit).join('') : value;
    return Number.parseInt(full, 16);
  }

  it('takes each colour from the night theme, the app\'s default', () => {
    expect(CARD_COLORS).toEqual({
      match: themeColor('color-match'),
      matchmaking: themeColor('color-success'),
      competition: themeColor('color-competition'),
      event: themeColor('color-event'),
      team: themeColor('color-team'),
      good: themeColor('color-success'),
      refused: themeColor('color-danger'),
      fellThrough: themeColor('color-text-secondary'),
    });
  });
});
