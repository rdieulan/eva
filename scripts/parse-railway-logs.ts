// One-shot helper to slice a Railway logs JSON dump into a readable summary.
// Usage: tsx scripts/parse-railway-logs.ts <path-to-logs.json>

import * as fs from 'fs';

const file = process.argv[2];
if (!file) {
  console.error('Missing path to logs file');
  process.exit(1);
}

interface LogEntry {
  timestamp?: string;
  message?: string;
  severity?: string;
  tags?: Record<string, string>;
}

const raw = fs.readFileSync(file, 'utf8');
const data: LogEntry[] = JSON.parse(raw);

// Sort chronologically (Railway dumps oldest-first usually, but defensive sort)
data.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));

console.log(`Total entries: ${data.length}`);
console.log(`Span: ${data[0]?.timestamp} → ${data[data.length - 1]?.timestamp}`);

// Distinct service tags
const byService = new Map<string, number>();
for (const e of data) {
  const svc = e.tags?.service ?? 'no-service';
  byService.set(svc, (byService.get(svc) ?? 0) + 1);
}
console.log(`\nEntries per service tag:`);
for (const [svc, count] of byService) console.log(`  ${count.toString().padStart(4)} × ${svc}`);

// Distinct deployment ids
const byDeploy = new Map<string, { count: number; first: string; last: string }>();
for (const e of data) {
  const id = e.tags?.deployment ?? 'no-deploy';
  const ts = e.timestamp ?? '';
  const cur = byDeploy.get(id);
  if (!cur) byDeploy.set(id, { count: 1, first: ts, last: ts });
  else { cur.count += 1; cur.last = ts; }
}
console.log(`\nDeployments seen:`);
for (const [id, s] of byDeploy) console.log(`  ${id} — ${s.count} entries, ${s.first} → ${s.last}`);

// Key events: container start/stop, server start, DB events, errors
const keyPattern = /Starting Container|Stopping Container|Server started|SIGTERM|SIGKILL|Connection successful|Connection attempt|All connection attempts failed|ENOENT|FATAL|Uncaught|UnhandledPromiseRejection|connection terminated|ECONNREFUSED|exit code/i;

const keyEvents = data.filter(e => keyPattern.test(e.message ?? ''));
console.log(`\n=== Key events (${keyEvents.length}) — chronological ===`);
for (const e of keyEvents) {
  const ts = e.timestamp ?? '?';
  const sev = (e.severity ?? '').toUpperCase().padEnd(7);
  console.log(`${ts} [${sev}] ${(e.message ?? '').slice(0, 220)}`);
}

// Last 30 messages of any kind
console.log(`\n=== Last 30 entries chronologically ===`);
for (const e of data.slice(-30)) {
  const ts = e.timestamp ?? '?';
  const sev = (e.severity ?? '').toUpperCase().padEnd(7);
  const svc = (e.tags?.service ?? '').slice(0, 8);
  console.log(`${ts} [${sev}] (${svc}) ${(e.message ?? '').slice(0, 200)}`);
}
