-- CreateEnum
CREATE TYPE "BalanceSeverity" AS ENUM ('ERROR', 'WARNING');

-- CreateTable
CREATE TABLE "BalanceRule" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "severity" "BalanceSeverity" NOT NULL DEFAULT 'ERROR',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BalanceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BalanceRule_teamId_idx" ON "BalanceRule"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceRule_teamId_ruleKey_key" ON "BalanceRule"("teamId", "ruleKey");

-- AddForeignKey
ALTER TABLE "BalanceRule" ADD CONSTRAINT "BalanceRule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
