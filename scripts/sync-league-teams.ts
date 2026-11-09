// Read the league teams of competitive.eva.gg into the directory, now
//
// Usage: npm run db:sync-league-teams
//
// The production server reads the list again every night by itself. This reads
// it at once: on a new database, or in development, where the server never
// calls the site by itself. One call per page of 50 teams, 3 seconds apart.
//
// Run with the server's tsconfig: it reads the list the way the server does,
// through the server's own code.

import '../server/src/env';
import { syncLeagueDirectory } from '../server/src/services/league-directory.service';
import { prisma, pool } from '../server/src/db/prisma';

async function main() {
  console.log('Équipes de ligue (competitive.eva.gg)\n');
  const report = await syncLeagueDirectory();
  const skipped = report.skipped ? `, ${report.skipped} entrées écartées` : '';
  console.log(`${report.teams} équipes lues en ${report.pages} pages${skipped}`);
  console.log(`Ajoutées : ${report.added} · modifiées : ${report.changed} · retirées : ${report.removed}`);
}

main()
  .catch(error => {
    console.error('Lecture échouée, annuaire inchangé :', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
