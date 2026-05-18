// Interactive script to create a super admin account
//
// Usage: npm run create-admin
//
// Prompts for email, name and password. Creates an Admin record with all
// permissions set to true (super admin) and the linked User account.

import * as readline from 'readline';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { validateEmail, validateName, validatePassword } from '../shared/utils/validation.utils';

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

interface MutableInterface extends readline.Interface {
  output: NodeJS.WritableStream;
  _writeToOutput?: (s: string) => void;
}

function createPrompt(): MutableInterface {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  }) as MutableInterface;
  return rl;
}

function ask(rl: MutableInterface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

function askSecret(rl: MutableInterface, question: string): Promise<string> {
  return new Promise((resolve) => {
    // Mute output while typing password
    const originalWrite = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    let muted = false;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = function (s: string) {
      if (muted) {
        // Only echo line endings to keep prompt responsive
        if (s === '\n' || s === '\r' || s === '\r\n') {
          process.stdout.write(s);
        }
        return;
      }
      process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      muted = false;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = originalWrite;
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function promptValid<T>(
  rl: MutableInterface,
  question: string,
  validator: (value: string) => true | string[],
  secret = false,
): Promise<string> {
  while (true) {
    const value = secret ? await askSecret(rl, question) : await ask(rl, question);
    const result = validator(value);
    if (result === true) return value;
    for (const error of result) {
      console.error(`  ✗ ${error}`);
    }
  }
}

async function main(): Promise<void> {
  console.log('\n=== Création d\'un super admin EVA ===\n');

  const rl = createPrompt();

  try {
    const email = (await promptValid(rl, 'Email     : ', validateEmail)).toLowerCase().trim();

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      console.error(`\n❌ L'email "${email}" est déjà utilisé.`);
      process.exit(1);
    }

    const name = (await promptValid(rl, 'Pseudo    : ', validateName)).trim();

    const password = await promptValid(rl, 'Mot de passe : ', validatePassword, true);
    const confirm = await askSecret(rl, 'Confirmer    : ');
    if (password !== confirm) {
      console.error('\n❌ Les mots de passe ne correspondent pas.');
      process.exit(1);
    }

    rl.close();

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.create({
      data: { permissions: SUPER_ADMIN_PERMISSIONS },
    });

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        adminId: admin.id,
      },
    });

    console.log('\n✅ Super admin créé avec succès');
    console.log(`   User ID  : ${user.id}`);
    console.log(`   Admin ID : ${admin.id}`);
    console.log(`   Email    : ${user.email}`);
    console.log(`   Pseudo   : ${user.name}\n`);
  } catch (error) {
    rl.close();
    console.error('\n❌ Erreur :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
