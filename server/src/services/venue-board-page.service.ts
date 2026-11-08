// The page a link to a venue's public board serves: the app's own page, with
// the board's title and sentence written in, so that wherever the link is
// posted (Discord, a chat, a social network) it shows the venue. Those
// readers run no script: the app alone could not tell them.

import type { RequestHandler } from 'express';
import { prisma } from '@db/prisma';
import { describeVenueBoard } from '@shared/utils';

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => HTML_ESCAPES[character]!);
}

/**
 * The app's page with a venue's board written in: its title, and the tags
 * link previews read
 */
export function withVenueBoardPreview(indexHtml: string, venueName: string): string {
  const { title, lead } = describeVenueBoard(venueName);
  const tags = [
    `<meta name="description" content="${escapeHtml(lead)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="EVA" />',
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(lead)}" />`,
    '<meta name="twitter:card" content="summary" />',
  ];
  // Replaced through functions: a name holding "$&" stays as it is
  return indexHtml
    .replace(/<title>[^<]*<\/title>/, () => `<title>EVA - ${escapeHtml(title)}</title>`)
    .replace('</head>', () => `  ${tags.join('\n    ')}\n  </head>`);
}

/**
 * Serve a venue's board: the app's page with the venue written in. A venue
 * unknown gets the page as it is, with a 404, and the app says so.
 */
export function venueBoardPage(indexHtml: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const venue = await prisma.venue.findUnique({ where: { slug: String(req.params.slug) }, select: { name: true } });
      res.status(venue ? 200 : 404).type('html').send(venue ? withVenueBoardPreview(indexHtml, venue.name.trim()) : indexHtml);
    } catch (error) {
      next(error);
    }
  };
}
