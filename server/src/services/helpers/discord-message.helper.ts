// Notifications as Discord messages: the card a team's channel shows, laid out
// from the words of the bell cut in pieces (describeNotification): the other
// team and its logo, what happened, when and where, their word or the reason,
// then what there is to do. And what a venue publishes, as a card of its own
// Discord.

import type { NotificationContent, NotificationKind, PublicationTiming, VenuePublicationFacts } from '@shared/types';
import { dayAndHours, describeNotification, notificationLook, notificationTargetPath } from '@shared/utils';
import { APP_NAME } from '@shared/constants';
import { appUrl } from '@utils/app-url';
import type { DiscordMessage } from '../../integrations/discord/discord-webhook';

// The name the cards are posted under, whatever the team named its webhook
const POSTED_AS = APP_NAME;
const MATCHMAKING_FOOTER = `${APP_NAME} · Matchmaking`;
const TEAM_FOOTER = `${APP_NAME} · Équipe`;
const LEAGUE_FOOTER = `${APP_NAME} · Ligue`;
const COMPETITION_FOOTER = `${APP_NAME} · Compétition`;
const VENUE_FOOTER = `${APP_NAME} · Salle`;

// The part of the app each kind comes from, at the foot of its card
const KIND_FOOTERS: Record<NotificationKind, string> = {
  SCRIM_PROPOSAL_RECEIVED: MATCHMAKING_FOOTER,
  SCRIM_MATCH_MADE: MATCHMAKING_FOOTER,
  SCRIM_MATCH_CANCELLED: MATCHMAKING_FOOTER,
  SCRIM_PROPOSAL_DECLINED: MATCHMAKING_FOOTER,
  SCRIM_SEARCH_WITHDRAWN: MATCHMAKING_FOOTER,
  SCRIM_SEARCH_EXPIRED: MATCHMAKING_FOOTER,
  TEAM_JOIN_REQUESTED: TEAM_FOOTER,
  LEAGUE_REGISTRATION_OPEN: LEAGUE_FOOTER,
  LEAGUE_REGISTRATION_CLOSING: LEAGUE_FOOTER,
  COMPETITION_OFFERED: COMPETITION_FOOTER,
  COMPETITION_ADDED: COMPETITION_FOOTER,
  COMPETITION_WITHDRAWN: COMPETITION_FOOTER,
  COMPETITION_CHANGED: COMPETITION_FOOTER,
  VENUE_EVENT_WITHDRAWN: VENUE_FOOTER,
  VENUE_EVENT_CHANGED: VENUE_FOOTER,
};

// The bar of a card, coloured as the bell colours the same notification
// (docs/PRODUIT.md, *Code couleur*), in the colours of the night theme, the
// app's default: Discord shows a card the same in every theme
export const CARD_COLORS = {
  match: 0xfb923c,       // --color-match
  matchmaking: 0x4ade80, // --color-success: a match offered is to accept
  competition: 0x2dd4bf, // --color-competition
  event: 0x60a5fa,       // --color-event
  team: 0xf472b6,        // --color-team
  good: 0x4ade80,        // --color-success
  refused: 0x981b1b,     // --color-danger
  fellThrough: 0x888888, // --color-text-secondary
} as const;

function cardColor(content: NotificationContent): number {
  const { subject, tone } = notificationLook(content);
  if (tone === 'refused') return CARD_COLORS.refused;
  if (tone === 'fell-through') return CARD_COLORS.fellThrough;
  return CARD_COLORS[subject];
}

// An icon is wider and taller than a letter: a plain space leaves it glued to
// its text, and two lines of icons in a row touch
const GAP = '\u2002';
const LINKS_APART = '\u2003\u2003';

function withIcon(icon: string, text: string): string {
  return `${icon}${GAP}${text}`;
}

// The sign of each step to take, before its link; a step outside the app (booking on
// eva.gg, registering on competitive.eva.gg) has its own
const ACTION_ICONS: Record<NotificationKind, string> = {
  SCRIM_PROPOSAL_RECEIVED: '💬',
  SCRIM_MATCH_MADE: '🎮',
  SCRIM_MATCH_CANCELLED: '📆',
  SCRIM_PROPOSAL_DECLINED: '🔎',
  SCRIM_SEARCH_WITHDRAWN: '🔎',
  SCRIM_SEARCH_EXPIRED: '📆',
  TEAM_JOIN_REQUESTED: '👥',
  LEAGUE_REGISTRATION_OPEN: '👥',
  LEAGUE_REGISTRATION_CLOSING: '👥',
  COMPETITION_OFFERED: '💬',
  COMPETITION_ADDED: '🏆',
  COMPETITION_WITHDRAWN: '📆',
  COMPETITION_CHANGED: '📆',
  VENUE_EVENT_WITHDRAWN: '📆',
  VENUE_EVENT_CHANGED: '📆',
};
const ELSEWHERE_ICON = '🎟️';

// The sign before the title of each kind
const KIND_ICONS: Record<NotificationKind, string> = {
  SCRIM_PROPOSAL_RECEIVED: '🤝',
  SCRIM_MATCH_MADE: '✅',
  SCRIM_MATCH_CANCELLED: '❌',
  SCRIM_PROPOSAL_DECLINED: '🚫',
  SCRIM_SEARCH_WITHDRAWN: '🗑️',
  SCRIM_SEARCH_EXPIRED: '⌛',
  TEAM_JOIN_REQUESTED: '🙋',
  LEAGUE_REGISTRATION_OPEN: '📝',
  LEAGUE_REGISTRATION_CLOSING: '⏰',
  COMPETITION_OFFERED: '🏆',
  COMPETITION_ADDED: '✅',
  COMPETITION_WITHDRAWN: '🗑️',
  COMPETITION_CHANGED: '✏️',
  VENUE_EVENT_WITHDRAWN: '🗑️',
  VENUE_EVENT_CHANGED: '✏️',
};

// What Discord would read as formatting or a link in a team's name or message
const MARKDOWN = /[\\*_~|`>[\]()#]/g;

function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN, '\\$&');
}

// Someone's words as a quote, line by line
function quoted(text: string): string {
  return text.split(/\r?\n/).map(line => `> ${escapeMarkdown(line)}`).join('\n');
}

/**
 * A notification as a Discord card. The other team's logo is a file sent with
 * the message, named here when there is one. The links into the app need its
 * public address (APP_URL): none set, no link.
 */
export function notificationMessage(
  content: NotificationContent,
  { base = appUrl(), logo = null }: { base?: string | null; logo?: string | null } = {},
): DiscordMessage {
  const { title, who, when, where, quote, detail, target, action, elsewhere } = describeNotification(content);
  const appLink = base ? `${base}${notificationTargetPath(target)}` : null;

  const facts = [
    ...(when ? [withIcon('📅', `**${escapeMarkdown(when)}**`)] : []),
    ...(where ? [withIcon('📍', escapeMarkdown(where))] : []),
  ].join('\n\n');
  const word = quote ? quoted(quote) : detail ? escapeMarkdown(detail) : null;
  const links = [
    ...(appLink ? [withIcon(ACTION_ICONS[content.kind], `[${action}](${appLink})`)] : []),
    ...(elsewhere ? [withIcon(ELSEWHERE_ICON, `[${elsewhere.label}](${elsewhere.url})`)] : []),
  ].join(LINKS_APART);

  return {
    username: POSTED_AS,
    embeds: [{
      ...(who && { author: { name: who.name } }),
      // Not a link: Discord would underline the gap after the icon; the links come last
      title: withIcon(KIND_ICONS[content.kind], title),
      // Blank lines between when and where, the word, and what to do
      description: [facts, word, links].filter(Boolean).join('\n\n'),
      ...(logo && { thumbnail: { url: `attachment://${logo}` } }),
      color: cardColor(content),
      footer: { text: KIND_FOOTERS[content.kind] },
      timestamp: new Date().toISOString(),
    }],
  };
}

/**
 * What a venue tells the channel of its own Discord: a competition or an
 * event its manager published, changed, or withdrew
 */
export interface VenueAnnouncement {
  subject: 'competition' | 'event';
  change: 'published' | 'changed' | 'withdrawn';
  facts: VenuePublicationFacts; // As it now is, or as it was once withdrawn
  kind: string | null; // What a competition is, beside its title (competitionKind); nothing for an event
  before?: PublicationTiming | null; // Changed: when it was, if its day or hours moved
}

const ANNOUNCEMENT_TITLES = {
  competition: { published: 'Nouvelle compétition', changed: 'Compétition modifiée', withdrawn: 'Compétition annulée' },
  event: { published: 'Nouvel événement', changed: 'Événement modifié', withdrawn: 'Événement annulé' },
} as const;

const ANNOUNCEMENT_ICONS = { competition: '🏆', event: '📅' } as const;

/**
 * What the venue publishes, as a card of its own Discord, for its public:
 * its title, when, what it is, and the venue's word on it; changed, when it
 * was before too; withdrawn, when it was, in red. The channel is the
 * venue's: the card does not name it.
 */
export function venueAnnouncementMessage({ subject, change, facts, kind, before = null }: VenueAnnouncement): DiscordMessage {
  const when = withIcon('📅', `**${escapeMarkdown(dayAndHours(facts))}**`);
  const was = change === 'changed' && before ? escapeMarkdown(`Avant : ${dayAndHours(before)}.`) : null;
  const word = change !== 'withdrawn' && facts.description ? quoted(facts.description) : null;
  const icon = { published: ANNOUNCEMENT_ICONS[subject], changed: '✏️', withdrawn: '🗑️' }[change];
  return {
    username: POSTED_AS,
    embeds: [{
      author: { name: facts.title },
      title: withIcon(icon, ANNOUNCEMENT_TITLES[subject][change]),
      description: [when, was, kind ? escapeMarkdown(kind) : null, word].filter(Boolean).join('\n\n'),
      color: change === 'withdrawn' ? CARD_COLORS.refused : CARD_COLORS[subject],
      footer: { text: VENUE_FOOTER },
      timestamp: new Date().toISOString(),
    }],
  };
}

// What a channel just linked will get, by who it posts for
const LINKED_CHANNELS = {
  team: { says: (name: string) => `Les notifications de l'équipe ${name} arriveront ici.`, footer: TEAM_FOOTER },
  venue: { says: (name: string) => `Les publications de la salle ${name} arriveront ici.`, footer: VENUE_FOOTER },
} as const;

/** The first message of a channel just linked: Discord takes it, so the webhook works */
export function linkedMessage(owner: 'team' | 'venue', name: string): DiscordMessage {
  const channel = LINKED_CHANNELS[owner];
  return {
    username: POSTED_AS,
    embeds: [{
      title: withIcon('🔗', 'Salon relié'),
      description: channel.says(escapeMarkdown(name)),
      color: CARD_COLORS.good,
      footer: { text: channel.footer },
    }],
  };
}
