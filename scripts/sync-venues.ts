// Fill the venue list from the eva.gg public API
//
// Usage: npm run db:sync-venues [-- <pays>]   (pays: code ISO, FR par défaut)
//
// Re-runnable: venues are matched on the eva.gg location id, so running it
// again picks up newly opened arenas and corrected addresses. Venues created
// by hand in the admin screens have no such id and are never touched.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { fetchEvaLocations, toVenues, type VenueInput } from './lib/eva-locations';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://eva_user:eva_secret_password@localhost:5432/eva_db';
const pool = new pg.Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEFAULT_COUNTRY = 'FR';

// Fields the sync owns: a difference on any of them is worth reporting
const SYNCED_FIELDS = ['name', 'city', 'address', 'phone', 'arenaCount'] as const;

function changedFields(
  current: { name: string; city: string; address: string; phone: string | null; arenaCount: number },
  next: VenueInput,
): string[] {
  return SYNCED_FIELDS.filter(field => current[field] !== next[field]);
}

async function main() {
  const country = (process.argv[2] || DEFAULT_COUNTRY).toUpperCase();

  console.log(`Salles eva.gg (${country})\n`);

  const locations = await fetchEvaLocations(country);
  const { venues, skipped } = toVenues(locations);

  const known = await prisma.venue.findMany({
    where: { externalId: { not: null } },
    select: { externalId: true, name: true, city: true, address: true, phone: true, arenaCount: true },
  });
  const byExternalId = new Map(known.map(venue => [venue.externalId!, venue]));

  let created = 0;
  let updated = 0;

  for (const venue of venues) {
    const current = byExternalId.get(venue.externalId);

    if (!current) {
      await prisma.venue.create({ data: venue });
      created++;
      console.log(`  + ${venue.name} — ${venue.city} (${venue.arenaCount} arène${venue.arenaCount > 1 ? 's' : ''})`);
      continue;
    }

    const changed = changedFields(current, venue);
    if (changed.length === 0) continue;

    await prisma.venue.update({ where: { externalId: venue.externalId }, data: venue });
    updated++;
    console.log(`  ~ ${venue.name} — ${venue.city} (${changed.join(', ')})`);
  }

  const listedIds = new Set(venues.map(venue => venue.externalId));
  const gone = known.filter(venue => !listedIds.has(venue.externalId!));

  console.log(`\n${venues.length} salles listées par eva.gg : ${created} ajoutées, ${updated} mises à jour.`);

  for (const venue of skipped) {
    console.log(`  ! ${venue.name} ignorée : ${venue.reason}`);
  }
  // Never deleted: teams and matches may point at them
  for (const venue of gone) {
    console.log(`  ? ${venue.name} n'est plus listée par eva.gg, conservée en base`);
  }
}

main()
  .catch(error => {
    console.error(`\nÉchec de la synchronisation : ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
