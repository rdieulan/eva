-- The directory of the league teams of competitive.eva.gg: their names, member
-- counts and logos, read again every night from the site's public list, for a
-- player to find their team by its name.
CREATE TABLE "LeagueTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "logoId" TEXT,
    "logoData" BYTEA,
    "logoType" TEXT,
    "logoCopiedId" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueTeam_pkey" PRIMARY KEY ("id")
);
