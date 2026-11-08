// @vitest-environment node
// Tests for Discord webhooks: only Discord's own addresses, mentions never read, a refusal told apart.
// Run under Node, as the server: the browser stand-in drops the name of a file sent in a form.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeWebhook, normalizeWebhookUrl } from '../../../server/src/integrations/discord/discord-webhook';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abc_DEF-123';
const MESSAGE = { username: 'EVA', embeds: [{ title: 'Match calé' }] };

describe('normalizeWebhookUrl', () => {
  it('takes a webhook address as Discord gives it, rewritten the one way it is called', () => {
    expect(normalizeWebhookUrl(WEBHOOK)).toBe(WEBHOOK);
    expect(normalizeWebhookUrl(`  ${WEBHOOK}/  `)).toBe(WEBHOOK);
    expect(normalizeWebhookUrl('https://discordapp.com/api/webhooks/123456789/abc_DEF-123')).toBe(WEBHOOK);
    expect(normalizeWebhookUrl('https://canary.discord.com/api/webhooks/123456789/abc_DEF-123')).toBe(WEBHOOK);
    expect(normalizeWebhookUrl('https://ptb.discord.com/api/v10/webhooks/123456789/abc_DEF-123?wait=true#x')).toBe(WEBHOOK);
  });

  it('refuses any other address, so that nothing else is ever called', () => {
    for (const input of [
      'http://discord.com/api/webhooks/123456789/abc',
      'https://discord.com.evil.example/api/webhooks/123456789/abc',
      'https://evil.example/api/webhooks/123456789/abc',
      'https://discord.com:8443/api/webhooks/123456789/abc',
      'https://user:pass@discord.com/api/webhooks/123456789/abc',
      'https://discord.com/api/webhooks/abc/def',
      'https://discord.com/api/channels/123456789/messages',
      'https://127.0.0.1/api/webhooks/123456789/abc',
      'pas une adresse',
      '',
      null,
      42,
    ]) {
      expect(normalizeWebhookUrl(input)).toBeNull();
    }
  });
});

describe('executeWebhook', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the message, mentions never read from its text', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await executeWebhook(WEBHOOK, MESSAGE)).toEqual({ status: 'sent' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ ...MESSAGE, allowed_mentions: { parse: [] } });
  });

  it('sends the files a card shows with the message, as Discord reads them', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const logo = { name: 'logo.png', type: 'image/png', data: new Uint8Array([137, 80, 78, 71]) };
    const message = { username: 'EVA', embeds: [{ title: 'Match calé', thumbnail: { url: 'attachment://logo.png' } }] };

    expect(await executeWebhook(WEBHOOK, message, [logo])).toEqual({ status: 'sent' });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers).toBeUndefined();
    const form = init.body as FormData;
    expect(JSON.parse(form.get('payload_json') as string)).toEqual({
      ...message,
      allowed_mentions: { parse: [] },
      attachments: [{ id: 0, filename: 'logo.png' }],
    });
    const file = form.get('files[0]') as File;
    expect(file.name).toBe('logo.png');
    expect(file.type).toBe('image/png');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(logo.data);
  });

  it('tells a webhook Discord no longer knows from a failure', async () => {
    for (const status of [401, 403, 404]) {
      fetchMock.mockResolvedValueOnce(new Response('{}', { status }));
      expect(await executeWebhook(WEBHOOK, MESSAGE)).toEqual({ status: 'refused' });
    }
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect(await executeWebhook(WEBHOOK, MESSAGE)).toEqual({ status: 'failed', reason: 'HTTP 500' });
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    expect(await executeWebhook(WEBHOOK, MESSAGE)).toEqual({ status: 'failed', reason: 'TimeoutError' });
  });

  it('waits once when Discord asks to slow down, then tries again', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ retry_after: 0.01 }), { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    expect(await executeWebhook(WEBHOOK, MESSAGE)).toEqual({ status: 'sent' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up when Discord asks to wait too long, or asks twice', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }));
    expect(await executeWebhook(WEBHOOK, MESSAGE)).toEqual({ status: 'failed', reason: 'HTTP 429' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ retry_after: 0.01 }), { status: 429 }));
    expect(await executeWebhook(WEBHOOK, MESSAGE)).toEqual({ status: 'failed', reason: 'HTTP 429' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
