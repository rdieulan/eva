/**
 * Migration script: Import game plans from JSON files to database
 *
 * Prerequisites:
 * 1. Database must be empty (run prisma db push --force-reset)
 * 2. Seed must be run first (npm run db:seed) to create users and maps
 *
 * This script:
 * 1. Reads JSON files from /public/maps/
 * 2. Creates GamePlan entries with assignments data
 * 3. Creates GamePlanPlayer entries using the user order from seed
 *
 * The JSON files use player1, player2, etc. which map to users in seed order:
 * - player1 = 1st user in seed (Nyork)
 * - player2 = 2nd user in seed (Kekew)
 * - etc.
 *
 * Usage: npm run db:migrate-data
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://eva_user:eva_secret_password@localhost:5432/eva_db';
const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface JsonMapData {
  id: string;
  name: string;
  images: string[];
  assignments: unknown[];
  players?: Record<string, number[]>; // player1: [1, 3], player2: [2, 4], etc.
}

async function main() {
  console.log('=== Migration JSON → DB ===\n');

  // 1. Get users from DB (in creation order)
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  if (users.length === 0) {
    console.error('❌ No users found. Run db:seed first.');
    process.exit(1);
  }

  console.log(`Found ${users.length} users:`);
  users.forEach((u, i) => console.log(`  player${i + 1} → ${u.name} (${u.id})`));

  // 2. Read JSON files
  const mapsDir = path.join(process.cwd(), 'public', 'maps');
  const mapFolders = fs.readdirSync(mapsDir);

  console.log(`\nProcessing ${mapFolders.length} maps...\n`);

  for (const folder of mapFolders) {
    const jsonPath = path.join(mapsDir, folder, `${folder}.json`);

    if (!fs.existsSync(jsonPath)) {
      console.log(`⚠️  ${folder}: no JSON file, skipping`);
      continue;
    }

    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    const mapData: JsonMapData = JSON.parse(jsonContent);

    // Check map exists in DB
    const map = await prisma.map.findUnique({ where: { id: mapData.id } });
    if (!map) {
      console.log(`⚠️  ${mapData.id}: not in DB, skipping`);
      continue;
    }

    // Check if GamePlan already exists
    const existingPlan = await prisma.gamePlan.findFirst({ where: { mapId: mapData.id } });
    if (existingPlan) {
      console.log(`⚠️  ${mapData.id}: GamePlan exists, skipping`);
      continue;
    }

    // Create GamePlan
    const gamePlan = await prisma.gamePlan.create({
      data: {
        name: `${mapData.name} - Default`,
        mapId: mapData.id,
        assignments: mapData.assignments as any
      }
    });

    console.log(`✓ ${mapData.name}: created GamePlan`);

    // Create GamePlanPlayer entries
    if (mapData.players) {
      for (const [playerId, assignmentIds] of Object.entries(mapData.players)) {
        // player1 → index 0, player2 → index 1, etc.
        const playerIndex = parseInt(playerId.replace('player', '')) - 1;
        const user = users[playerIndex];

        if (!user) {
          console.log(`  ⚠️  ${playerId}: no matching user at index ${playerIndex}`);
          continue;
        }

        await prisma.gamePlanPlayer.create({
          data: {
            gamePlanId: gamePlan.id,
            userId: user.id,
            assignmentIds: assignmentIds
          }
        });

        console.log(`  → ${user.name}: [${assignmentIds.join(', ')}]`);
      }
    }
  }

  console.log('\n✅ Migration completed!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

