import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://eva_user:eva_secret_password@localhost:5432/eva_db';
const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Créer les 5 utilisateurs
  const users = [
    { email: 'tailhades8@hotmail.com', nom: 'Nyork', role: Role.PLAYER },
    { email: 'Kevindijusco30@gmail.com', nom: 'Kekew', role: Role.PLAYER },
    { email: 'mathieu.lietsch@gmail.com', nom: 'Matic', role: Role.PLAYER },
    { email: 'sokehur@gmail.com', nom: 'Sib', role: Role.ADMIN },
    { email: 'clemencefadvolf0102@gmail.com', nom: 'Celesta', role: Role.PLAYER },
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash('changeme123', 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        nom: user.nom,
        role: user.role,
        password: hashedPassword,
      },
      create: {
        email: user.email,
        password: hashedPassword,
        nom: user.nom,
        role: user.role,
      },
    });

    console.log(`Created user: ${user.nom} (${user.email})`);
  }

  console.log('Seed completed: 5 users created');
  console.log('Default password: changeme123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

