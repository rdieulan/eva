-- Step 1: Create Team table
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "location" TEXT,
    "leaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- Step 2: Add new columns to User (nullable initially)
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;
ALTER TABLE "User" ADD COLUMN "teamId" TEXT;

-- Step 3: Migrate existing data - ADMIN users get leader permissions
UPDATE "User"
SET "permissions" = '{"planner":{"canCreate":true,"canEdit":true,"canDelete":true},"calendar":{"canCreateEvents":true,"canEditEvents":true,"canDeleteEvents":true,"canAttachGamePlan":true},"team":{"canManageTeam":true,"canInviteMembers":true,"canRemoveMembers":true,"canManagePermissions":true}}'::jsonb
WHERE "role" = 'ADMIN';

-- Step 4: Migrate existing data - PLAYER users get default permissions
UPDATE "User"
SET "permissions" = '{"planner":{"canCreate":false,"canEdit":false,"canDelete":false},"calendar":{"canCreateEvents":false,"canEditEvents":false,"canDeleteEvents":false,"canAttachGamePlan":false},"team":{"canManageTeam":false,"canInviteMembers":false,"canRemoveMembers":false,"canManagePermissions":false}}'::jsonb
WHERE "role" = 'PLAYER';

-- Step 5: Create team for first ADMIN user
INSERT INTO "Team" ("id", "name", "leaderId", "updatedAt")
SELECT
    gen_random_uuid()::text,
    'Mon équipe',
    "id",
    NOW()
FROM "User"
WHERE "role" = 'ADMIN'
LIMIT 1;

-- Step 6: Assign all users to the created team
UPDATE "User"
SET "teamId" = (SELECT "id" FROM "Team" LIMIT 1)
WHERE EXISTS (SELECT 1 FROM "Team");

-- Step 7: Add foreign keys and unique constraint
CREATE UNIQUE INDEX "Team_leaderId_key" ON "Team"("leaderId");
ALTER TABLE "Team" ADD CONSTRAINT "Team_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 8: Drop the role column and enum (after data migration)
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";
