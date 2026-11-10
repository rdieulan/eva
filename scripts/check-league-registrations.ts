// Check now the registrations of our linked teams to their local league on
// competitive.eva.gg, and tell those who manage a team not registered
//
// Usage: npm run db:check-league-registrations
//
// The production server checks them every night by itself, after the
// directory. This checks them at once: in development, where the server never
// calls the site by itself. One call per linked team and one per league, 3
// seconds apart; the notifications go as the nightly check sends them, in the
// app's bell and in the teams' Discord channels.
//
// Run with the server's tsconfig: it reads the site the way the server does,
// through the server's own code.

import '../server/src/env';
import { checkLeagueRegistrations } from '../server/src/services/league-registrations.service';
import { settleDiscordPosts } from '../server/src/services/notification-discord.service';
import { prisma, pool } from '../server/src/db/prisma';

async function main() {
  console.log('Inscriptions aux ligues locales (competitive.eva.gg)\n');
  const report = await checkLeagueRegistrations();
  // The Discord cards leave without the check waiting for them: they end before the script does
  await settleDiscordPosts();
  const failed = report.failed ? `, ${report.failed} lectures échouées` : '';
  console.log(`${report.teams} équipes reliées lues, ${report.leagues} ligues${failed}`);
  console.log(`Mois ouverts à l'inscription : ${report.open} · équipes inscrites : ${report.registered}`);
  console.log(`Prévenues à l'ouverture : ${report.openNotices} · dernier rappel : ${report.closingNotices} · mois oubliés : ${report.removed}`);
}

main()
  .catch(error => {
    console.error('Vérification échouée :', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
