-- The monthly registration of our linked teams to their local league on
-- competitive.eva.gg: the tournaments of the leagues, read every night, and for
-- each team and open tournament whether it is registered and what those who
-- manage it were told, once at the opening and once before the closing.
ALTER TYPE "NotificationKind" ADD VALUE 'LEAGUE_REGISTRATION_OPEN';
ALTER TYPE "NotificationKind" ADD VALUE 'LEAGUE_REGISTRATION_CLOSING';

CREATE TABLE "LeagueTournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "startsOn" DATE,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueTournament_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeagueEntry" (
    "teamId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3),
    "openNoticeAt" TIMESTAMP(3),
    "closingNoticeAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueEntry_pkey" PRIMARY KEY ("teamId","tournamentId")
);

CREATE INDEX "LeagueTournament_regionId_idx" ON "LeagueTournament"("regionId");

CREATE INDEX "LeagueEntry_tournamentId_idx" ON "LeagueEntry"("tournamentId");

ALTER TABLE "LeagueEntry" ADD CONSTRAINT "LeagueEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueEntry" ADD CONSTRAINT "LeagueEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "LeagueTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
