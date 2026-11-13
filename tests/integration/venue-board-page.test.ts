// Integration tests - The page a link to a venue's public board serves, for
// where the link is posted (Discord, a chat): the app's page, the venue written in
//
// The app serves it in production only, from the built client: here the same
// handler serves a stand-in page.

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from './helpers/db';
import { venueBoardPage } from '../../server/src/services/venue-board-page.service';
import { APP_NAME } from '@shared/constants';

const INDEX_HTML = [
  '<!doctype html>',
  '<html lang="fr">',
  '  <head>',
  '    <meta charset="UTF-8" />',
  '    <title>Scrim Calendar</title>',
  '  </head>',
  '  <body><div id="app"></div></body>',
  '</html>',
].join('\n');

const page = express();
page.get('/salles/:slug', venueBoardPage(INDEX_HTML));

beforeEach(async () => {
  await prisma.venue.createMany({
    data: [
      { id: 'venue-nimes', slug: 'nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue' },
      { id: 'venue-odd', slug: 'odd', name: 'L\'Arène "A&B" <$&>', city: 'Paris', address: '2 rue' },
    ],
  });
});

describe('GET /salles/:slug (the page a board link serves)', () => {
  it('writes the venue into the page, for the preview of the link', async () => {
    const res = await request(page).get('/salles/nimes');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain(`<title>${APP_NAME} - Scrims à Nîmes</title>`);
    expect(res.text).not.toContain('Planificateur d\'équipe');
    expect(res.text).toContain('<meta property="og:title" content="Scrims à Nîmes" />');
    expect(res.text).toContain('<meta property="og:description" content="Les équipes qui cherchent un adversaire, jour par jour." />');
    // Still the app's page: it loads and shows the board
    expect(res.text).toContain('<div id="app"></div>');
  });

  it('keeps a name as it is, whatever it holds', async () => {
    const res = await request(page).get('/salles/odd');

    expect(res.text).toContain('<meta property="og:title" content="Scrims à L&#39;Arène &quot;A&amp;B&quot; &lt;$&amp;&gt;" />');
    expect(res.text).toContain(`<title>${APP_NAME} - Scrims à L&#39;Arène &quot;A&amp;B&quot; &lt;$&amp;&gt;</title>`);
  });

  it('serves the page as it is for a venue it does not know, and says so', async () => {
    const res = await request(page).get('/salles/nulle-part');

    expect(res.status).toBe(404);
    expect(res.text).toBe(INDEX_HTML);
  });
});
