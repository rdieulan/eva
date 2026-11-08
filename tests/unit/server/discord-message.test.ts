// Tests for notifications as Discord cards: the other team, what happened, when and where, their word, what to do
import { describe, it, expect } from 'vitest';
import { linkedMessage, notificationMessage } from '../../../server/src/services/helpers/discord-message.helper';
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
      color: 0x5865f2,
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
    expect(embed!.color).toBe(0x3ba55d);
    expect(embed!.description).toBe([
      WHEN_WHERE,
      'Chacun réserve sa place sur eva.gg.',
      `🎮${GAP}[Voir le match](${BASE}/calendar?date=2026-11-25&mode=team&event=event-1)${LINKS_APART}🎟️${GAP}[Réserver ma place sur eva.gg](${buildEvaBookingUrl(51, '2026-11-25')})`,
    ].join('\n\n'));
    // No logo for the team: no picture
    expect(embed).not.toHaveProperty('thumbnail');
  });

  it('says why a proposal fell, and colours what fell through, what was called off and what is to answer apart', () => {
    const declined = notificationMessage({
      kind: 'SCRIM_PROPOSAL_DECLINED', data: { ...FACTS, searchId: 'search-1', teamName: 'Les Faucons', reason: 'RUN_TAKEN' },
    }, { base: BASE }).embeds[0]!;
    const cancelled = notificationMessage({ kind: 'SCRIM_MATCH_CANCELLED', data: { ...FACTS, opponentName: 'Nova', byOpponent: true } }, { base: BASE }).embeds[0]!;

    expect(declined.title).toBe(`🚫${GAP}Proposition annulée`);
    expect(declined.description).toContain(`\n\nUn des créneaux a été réservé à la salle entre-temps.\n\n🔎${GAP}[Voir leur recherche](`);
    expect(declined.color).toBe(0x99aab5);
    expect(cancelled.title).toBe(`❌${GAP}Match annulé`);
    expect(cancelled.description).toContain(`📆${GAP}[Ouvrir le calendrier](`);
    expect(cancelled.color).toBe(0xed4245);
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

  it('lays a search closed with no match out with its day alone', () => {
    const [embed] = notificationMessage({ kind: 'SCRIM_SEARCH_EXPIRED', data: { searchId: 'search-1', date: '2026-11-25' } }, { base: BASE }).embeds;

    expect(embed).not.toHaveProperty('author');
    expect(embed!.title).toBe(`⌛${GAP}Recherche close sans match`);
    expect(embed!.description!.startsWith(`📅${GAP}**mer. 25/11**\n\nSes créneaux ont été réservés`)).toBe(true);
  });
});

describe('linkedMessage', () => {
  it('tells the channel just linked what will arrive there', () => {
    expect(linkedMessage('Les_Rivaux').embeds[0]).toEqual({
      title: `🔗${GAP}Salon relié`,
      description: 'Les notifications de l\'équipe Les\\_Rivaux arriveront ici.',
      color: 0x3ba55d,
      footer: { text: 'EVA · Matchmaking' },
    });
  });
});
