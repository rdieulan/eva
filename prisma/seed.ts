import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://eva_user:eva_secret_password@localhost:5432/eva_db';
const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Default template structure (based on Outlaw - untouched reference)
// Note: player assignments are managed via GamePlanPlayer table, not in template
const DEFAULT_TEMPLATE = {
  assignments: [
    { id: 1, name: "Poste 1", x: 25, y: 25, zone: { x1: 15, y1: 15, x2: 35, y2: 35 } },
    { id: 2, name: "Poste 2", x: 75, y: 25, zone: { x1: 65, y1: 15, x2: 85, y2: 35 } },
    { id: 3, name: "Poste 3", x: 25, y: 75, zone: { x1: 15, y1: 65, x2: 35, y2: 85 } },
    { id: 4, name: "Poste 4", x: 75, y: 75, zone: { x1: 65, y1: 65, x2: 85, y2: 85 } }
  ]
};

// Maps data
const MAPS = [
  { id: 'artefact', name: 'Artefact', images: ['/maps/artefact/Artefact.png'] },
  { id: 'atlantis', name: 'Atlantis', images: ['/maps/atlantis/Atlantis.png'] },
  { id: 'ceres', name: 'Ceres', images: ['/maps/ceres/Ceres.png'] },
  { id: 'engine', name: 'Engine', images: ['/maps/engine/Engine.png'] },
  { id: 'helios', name: 'Helios', images: ['/maps/helios/Helios_0.png', '/maps/helios/Helios_1.png'] },
  { id: 'horizon', name: 'Horizon', images: ['/maps/horizon/Horizon.png'] },
  { id: 'lunar', name: 'Lunar', images: ['/maps/lunar/Lunar.png'] },
  { id: 'outlaw', name: 'Outlaw', images: ['/maps/outlaw/Outlaw.png'] },
  { id: 'polaris', name: 'Polaris', images: ['/maps/polaris/Polaris.png'] },
  { id: 'silva', name: 'Silva', images: ['/maps/silva/Silva.png'] },
  { id: 'thecliff', name: 'The Cliff', images: ['/maps/thecliff/TheCliff.png'] },
];

async function main() {
  console.log('Seeding database...\n');

  // ========== USERS ==========
  console.log('Creating users...');
  const users = [
    { email: 'tailhades8@hotmail.com', name: 'Nyork', role: Role.PLAYER },
    { email: 'Kevindijusco30@gmail.com', name: 'Kekew', role: Role.PLAYER },
    { email: 'mathieu.lietsch@gmail.com', name: 'Matic', role: Role.PLAYER },
    { email: 'sokehur@gmail.com', name: 'Sib', role: Role.ADMIN },
    { email: 'clemencefadvolf0102@gmail.com', name: 'Celesta', role: Role.PLAYER },
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash('changeme123', 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        password: hashedPassword,
      },
      create: {
        email: user.email,
        password: hashedPassword,
        name: user.name,
        role: user.role,
      },
    });

    console.log(`  ✓ ${user.name} (${user.email}) - ${user.role}`);
  }

  // ========== MAPS ==========
  console.log('\nCreating maps with default templates...');
  for (const map of MAPS) {
    await prisma.map.upsert({
      where: { id: map.id },
      update: {
        name: map.name,
        images: map.images,
      },
      create: {
        id: map.id,
        name: map.name,
        images: map.images,
        template: DEFAULT_TEMPLATE,
      },
    });

    console.log(`  ✓ ${map.name} (${map.id})`);
  }

  console.log('\n✅ Seed completed!');
  console.log(`   - ${users.length} users created (default password: changeme123)`);
  console.log(`   - ${MAPS.length} maps created with default templates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
