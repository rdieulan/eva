-- Migration: add_venues_and_roles
-- This migration refactors the User table into User + Player + Manager + Admin

-- ============================================
-- Step 1: Create new tables
-- ============================================

-- LinkedAccountGroup
CREATE TABLE "LinkedAccountGroup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkedAccountGroup_pkey" PRIMARY KEY ("id")
);

-- Player
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "permissions" JSONB,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- Manager
CREATE TABLE "Manager" (
    "id" TEXT NOT NULL,
    "permissions" JSONB,
    "activationToken" TEXT,
    "activationTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

-- Admin
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "activationToken" TEXT,
    "activationTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- Venue
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- VenueManager
CREATE TABLE "VenueManager" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueManager_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- Step 2: Create Player records from existing Users
-- ============================================

INSERT INTO "Player" ("id", "permissions", "teamId", "createdAt", "updatedAt")
SELECT
    "id",
    "permissions",
    "teamId",
    "createdAt",
    "updatedAt"
FROM "User";

-- ============================================
-- Step 3: Add new columns to User
-- ============================================

ALTER TABLE "User" ADD COLUMN "playerId" TEXT;
ALTER TABLE "User" ADD COLUMN "managerId" TEXT;
ALTER TABLE "User" ADD COLUMN "adminId" TEXT;
ALTER TABLE "User" ADD COLUMN "linkedAccountGroupId" TEXT;

-- ============================================
-- Step 4: Link Users to their Players
-- ============================================

UPDATE "User" SET "playerId" = "id";

-- ============================================
-- Step 5: Update foreign keys in related tables
-- ============================================

-- Availability: userId -> playerId
ALTER TABLE "Availability" RENAME COLUMN "userId" TO "playerId";

-- GamePlanPlayer: userId -> playerId
ALTER TABLE "GamePlanPlayer" RENAME COLUMN "userId" TO "playerId";

-- CalendarEvent: createdById stays but now references Player
-- TeamInvite: createdById stays but now references Player
-- Team: leaderId stays but now references Player

-- ============================================
-- Step 6: Add venueId to Team, drop location
-- ============================================

ALTER TABLE "Team" ADD COLUMN "venueId" TEXT;
ALTER TABLE "Team" DROP COLUMN "location";

-- ============================================
-- Step 7: Drop old columns from User
-- ============================================

ALTER TABLE "User" DROP COLUMN "permissions";
ALTER TABLE "User" DROP COLUMN "teamId";

-- Drop role column if it exists
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";

-- ============================================
-- Step 8: Add unique constraints and indexes
-- ============================================

CREATE UNIQUE INDEX "Manager_activationToken_key" ON "Manager"("activationToken");
CREATE UNIQUE INDEX "Admin_activationToken_key" ON "Admin"("activationToken");
CREATE UNIQUE INDEX "User_playerId_key" ON "User"("playerId");
CREATE UNIQUE INDEX "User_managerId_key" ON "User"("managerId");
CREATE UNIQUE INDEX "User_adminId_key" ON "User"("adminId");
CREATE UNIQUE INDEX "VenueManager_managerId_venueId_key" ON "VenueManager"("managerId", "venueId");

CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");
CREATE INDEX "User_linkedAccountGroupId_idx" ON "User"("linkedAccountGroupId");
CREATE INDEX "VenueManager_managerId_idx" ON "VenueManager"("managerId");
CREATE INDEX "VenueManager_venueId_idx" ON "VenueManager"("venueId");
CREATE INDEX "Team_venueId_idx" ON "Team"("venueId");

-- ============================================
-- Step 9: Update unique constraints on Availability and GamePlanPlayer
-- ============================================

-- Drop old constraints
ALTER TABLE "Availability" DROP CONSTRAINT IF EXISTS "Availability_userId_date_key";
ALTER TABLE "GamePlanPlayer" DROP CONSTRAINT IF EXISTS "GamePlanPlayer_gamePlanId_userId_key";

-- Add new constraints
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_playerId_date_key" UNIQUE ("playerId", "date");
ALTER TABLE "GamePlanPlayer" ADD CONSTRAINT "GamePlanPlayer_gamePlanId_playerId_key" UNIQUE ("gamePlanId", "playerId");

-- Drop old indexes
DROP INDEX IF EXISTS "GamePlanPlayer_userId_idx";

-- Add new indexes
CREATE INDEX "GamePlanPlayer_playerId_idx" ON "GamePlanPlayer"("playerId");

-- ============================================
-- Step 10: Add foreign key constraints
-- ============================================

-- Player
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- User -> Player/Manager/Admin/LinkedAccountGroup
ALTER TABLE "User" ADD CONSTRAINT "User_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_linkedAccountGroupId_fkey"
    FOREIGN KEY ("linkedAccountGroupId") REFERENCES "LinkedAccountGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- VenueManager
ALTER TABLE "VenueManager" ADD CONSTRAINT "VenueManager_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueManager" ADD CONSTRAINT "VenueManager_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Team -> Venue
ALTER TABLE "Team" ADD CONSTRAINT "Team_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update Team.leaderId to reference Player instead of User
ALTER TABLE "Team" DROP CONSTRAINT "Team_leaderId_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_leaderId_fkey"
    FOREIGN KEY ("leaderId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update Availability to reference Player
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_userId_fkey";
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update GamePlanPlayer to reference Player
ALTER TABLE "GamePlanPlayer" DROP CONSTRAINT "GamePlanPlayer_userId_fkey";
ALTER TABLE "GamePlanPlayer" ADD CONSTRAINT "GamePlanPlayer_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update CalendarEvent.createdById to reference Player
ALTER TABLE "CalendarEvent" DROP CONSTRAINT "CalendarEvent_createdById_fkey";
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update TeamInvite.createdById to reference Player
ALTER TABLE "TeamInvite" DROP CONSTRAINT "TeamInvite_createdById_fkey";
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
