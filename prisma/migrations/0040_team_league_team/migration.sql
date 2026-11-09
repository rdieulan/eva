-- A team of ours is linked to the league team it is on competitive.eva.gg, one
-- for one: a player who finds that league team in the directory finds the team
-- with it. A league team leaving the directory leaves the team unlinked.
ALTER TABLE "Team" ADD COLUMN "leagueTeamId" TEXT;

CREATE UNIQUE INDEX "Team_leagueTeamId_key" ON "Team"("leagueTeamId");

ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueTeamId_fkey" FOREIGN KEY ("leagueTeamId") REFERENCES "LeagueTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
