// Invite the first super admin, or another one
//
// Usage: npm run create-admin [-- "Name"]
//
// Creates an Admin with every permission, without an account yet, and prints
// its invitation link: whoever opens it and signs in with Discord becomes that
// admin, on their own account. Asks who it is for when no name is given.

import * as readline from 'readline';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { normalizeName, validateName } from '../shared/utils/validation.utils';
import { INVITATION_TTL_DAYS } from '../shared/constants/invitation.constants';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://eva_user:eva_secret_password@localhost:5432/eva_db';
const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Super admin = all permissions to true
const SUPER_ADMIN_PERMISSIONS = {
  system: {
    canManageVenues: true,
    canManageManagers: true,
    canManageAdmins: true,
    canViewAllData: true,
  },
};

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

// The name given on the command line, or asked until it fits the rule of a person's name
async function invitedName(): Promise<string> {
  const given = process.argv[2];
  if (given !== undefined) {
    const valid = validateName(given);
    if (valid !== true) {
      for (const error of valid) console.error(`  ✗ ${error}`);
      process.exit(1);
    }
    return normalizeName(given);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = await ask(rl, 'Pour qui est l\'invitation ? ');
      const valid = validateName(answer);
      if (valid === true) return normalizeName(answer);
      for (const error of valid) console.error(`  ✗ ${error}`);
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  console.log('\n=== Invitation d\'un super admin ===\n');

  try {
    const name = await invitedName();
    const activationToken = randomUUID();
    const admin = await prisma.admin.create({
      data: {
        permissions: SUPER_ADMIN_PERMISSIONS,
        activationToken,
        activationTokenExpiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
        invitedName: name,
      },
    });

    const base = process.env.APP_URL?.trim().replace(/\/+$/, '');
    const path = `/activate/${activationToken}`;
    console.log(`\n✅ Invitation créée pour ${name} (admin ${admin.id})`);
    console.log(`   Lien, valable ${INVITATION_TTL_DAYS} jours : ${base ? `${base}${path}` : path}`);
    if (!base) console.log('   (APP_URL n\'est pas réglée : ajoute l\'adresse du site devant le chemin)');
    console.log('   À ouvrir par la personne invitée, qui se connecte avec Discord.\n');
  } catch (error) {
    console.error('\n❌ Erreur :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
