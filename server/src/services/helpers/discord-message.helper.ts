// Notifications as Discord messages: the card a team's channel shows, laid out
// from the words of the bell cut in pieces (describeNotification): the other
// team and its logo, what happened, when and where, their word or the reason,
// then what there is to do

import type { NotificationContent, NotificationKind } from '@shared/types';
import { calendarTargetPath, describeNotification } from '@shared/utils';
import { appUrl } from '@utils/app-url';
import type { DiscordMessage } from '../../integrations/discord/discord-webhook';

// The name the cards are posted under, whatever the team named its webhook
const POSTED_AS = 'EVA';
const FOOTER = 'EVA · Matchmaking';

// The bar of a card: an answer awaited, a match made, a match called off, what fell through
const ANSWER_AWAITED = 0x5865f2;
const MATCH_MADE = 0x3ba55d;
const MATCH_CALLED_OFF = 0xed4245;
const FELL_THROUGH = 0x99aab5;

export const KIND_COLORS: Record<NotificationKind, number> = {
  SCRIM_PROPOSAL_RECEIVED: ANSWER_AWAITED,
  SCRIM_MATCH_MADE: MATCH_MADE,
  SCRIM_MATCH_CANCELLED: MATCH_CALLED_OFF,
  SCRIM_PROPOSAL_DECLINED: FELL_THROUGH,
  SCRIM_SEARCH_WITHDRAWN: FELL_THROUGH,
  SCRIM_SEARCH_EXPIRED: FELL_THROUGH,
};

// An icon is wider and taller than a letter: a plain space leaves it glued to
// its text, and two lines of icons in a row touch
const GAP = '\u2002';
const LINKS_APART = '\u2003\u2003';

function withIcon(icon: string, text: string): string {
  return `${icon}${GAP}${text}`;
}

// The sign of each step to take, before its link; booking on eva.gg has its own
const ACTION_ICONS: Record<NotificationKind, string> = {
  SCRIM_PROPOSAL_RECEIVED: '💬',
  SCRIM_MATCH_MADE: '🎮',
  SCRIM_MATCH_CANCELLED: '📆',
  SCRIM_PROPOSAL_DECLINED: '🔎',
  SCRIM_SEARCH_WITHDRAWN: '🔎',
  SCRIM_SEARCH_EXPIRED: '📆',
};
const BOOKING_ICON = '🎟️';

// The sign before the title of each kind
const KIND_ICONS: Record<NotificationKind, string> = {
  SCRIM_PROPOSAL_RECEIVED: '🤝',
  SCRIM_MATCH_MADE: '✅',
  SCRIM_MATCH_CANCELLED: '❌',
  SCRIM_PROPOSAL_DECLINED: '🚫',
  SCRIM_SEARCH_WITHDRAWN: '🗑️',
  SCRIM_SEARCH_EXPIRED: '⌛',
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
  const appLink = base ? `${base}${calendarTargetPath(target)}` : null;

  const facts = [
    withIcon('📅', `**${escapeMarkdown(when)}**`),
    ...(where ? [withIcon('📍', escapeMarkdown(where))] : []),
  ].join('\n\n');
  const word = quote ? quoted(quote) : detail ? escapeMarkdown(detail) : null;
  const links = [
    ...(appLink ? [withIcon(ACTION_ICONS[content.kind], `[${action}](${appLink})`)] : []),
    ...(elsewhere ? [withIcon(BOOKING_ICON, `[${elsewhere.label}](${elsewhere.url})`)] : []),
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
      color: KIND_COLORS[content.kind],
      footer: { text: FOOTER },
      timestamp: new Date().toISOString(),
    }],
  };
}

/** The first message of a channel just linked: Discord takes it, so the webhook works */
export function linkedMessage(teamName: string): DiscordMessage {
  return {
    username: POSTED_AS,
    embeds: [{
      title: withIcon('🔗', 'Salon relié'),
      description: `Les notifications de l'équipe ${escapeMarkdown(teamName)} arriveront ici.`,
      color: MATCH_MADE,
      footer: { text: FOOTER },
    }],
  };
}
