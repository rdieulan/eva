// Discord webhooks: posting a message in a channel through the address
// Discord gives for it, with no bot and no account. Only Discord's own
// addresses are ever called, whatever a team pastes.

const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com']);
const WEBHOOK_PATH = /^\/api\/(?:v\d+\/)?webhooks\/(\d+)\/([\w-]+)\/?$/;

// How long Discord has to answer, and the longest it may ask us to wait before a second try
const ANSWER_TIMEOUT_MS = 5000;
const RETRY_AFTER_MAX_MS = 5000;

const MS_PER_SECOND = 1000;

/**
 * A webhook address as Discord gives it, rewritten the one way it is called;
 * null for anything else, so that no other address is ever reached
 */
export function normalizeWebhookUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !DISCORD_HOSTS.has(url.hostname)) return null;
  const match = WEBHOOK_PATH.exec(url.pathname);
  return match ? `https://discord.com/api/webhooks/${match[1]}/${match[2]}` : null;
}

export interface DiscordEmbed {
  author?: { name: string }; // A small line above the title
  title: string;
  description?: string;
  color?: number;
  thumbnail?: { url: string }; // A small picture at the top right: attachment://<file> for a file sent with the message
  footer?: { text: string };
  timestamp?: string; // ISO date-time
}

// A file sent with a message, which its cards may show as attachment://<name>
export interface WebhookFile {
  name: string;
  type: string; // Its MIME type
  data: Uint8Array;
}

export interface DiscordMessage {
  username?: string; // The name the message is posted under, instead of the webhook's
  embeds: DiscordEmbed[];
}

/**
 * What became of a message: sent; refused, Discord no longer knowing the
 * webhook (deleted, or its token changed); or failed, for anything else
 */
export type WebhookOutcome = { status: 'sent' } | { status: 'refused' } | { status: 'failed'; reason: string };

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// How long Discord asks to wait before trying again, from its header or its body
async function retryAfterMs(response: Response): Promise<number> {
  const header = Number(response.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return header * MS_PER_SECOND;
  try {
    const body = await response.json() as { retry_after?: unknown };
    if (typeof body.retry_after === 'number') return body.retry_after * MS_PER_SECOND;
  } catch {
    // No body worth reading: the wait stays unknown
  }
  return Number.POSITIVE_INFINITY;
}

// The body of a post: the message alone as JSON, or the message and its files
// as a form, built anew for each try since a form is read only once
function postBody(message: DiscordMessage, files: WebhookFile[]): { body: string | FormData; headers?: Record<string, string> } {
  const payload = { ...message, allowed_mentions: { parse: [] } };
  if (!files.length) return { body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } };
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ ...payload, attachments: files.map((file, id) => ({ id, filename: file.name })) }));
  files.forEach((file, id) => form.append(`files[${id}]`, new Blob([new Uint8Array(file.data)], { type: file.type }), file.name));
  return { body: form };
}

/**
 * Post a message through a webhook, with the files its cards show, waiting
 * once when Discord asks to slow down. Mentions are never read from the
 * text: a team name cannot ping a whole server.
 */
export async function executeWebhook(url: string, message: DiscordMessage, files: WebhookFile[] = []): Promise<WebhookOutcome> {
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        ...postBody(message, files),
        signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
      });
    } catch (error) {
      return { status: 'failed', reason: error instanceof Error ? error.name : 'no answer' };
    }
    if (response.ok) return { status: 'sent' };
    if (response.status === 401 || response.status === 403 || response.status === 404) return { status: 'refused' };
    if (response.status === 429 && attempt === 1) {
      const wait = await retryAfterMs(response);
      if (wait <= RETRY_AFTER_MAX_MS) {
        await pause(wait);
        continue;
      }
    }
    return { status: 'failed', reason: `HTTP ${response.status}` };
  }
}
