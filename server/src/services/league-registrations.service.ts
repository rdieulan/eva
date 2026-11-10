// The monthly registration of our linked teams to their local league on
// competitive.eva.gg. Each month of a league is a tournament of its own, with
// its own registration; a team registered is listed among the tournaments of
// the team. Read after the directory every night: the tournaments of each
// linked team (whether it is registered, and its local league), then the latest
// tournaments of each of those leagues. Those who manage a team not registered
// to an open month are told when it opens, and three days before it closes;
// never twice the same. What a night finds stays for the home dashboard to come.

import { prisma } from '@db/prisma';
import { notify } from '@services/notification.service';
import { venueOfLeagueTournament } from '@services/league-directory.service';
import {
  fetchLeagueRegionTournaments,
  fetchLeagueTeamTournaments,
  type LeagueTournament,
} from '../integrations/competitive/competitive-teams';
import { logger } from '../utils/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

// Between two reads of the site: a check never comes as a burst
export const LEAGUE_REGISTRATION_READ_PAUSE_MS = 3000;

// How long before the registration closes the last reminder goes
const CLOSING_SOON_MS = 3 * DAY_MS;

// How long a month of a league is kept once its registration closed
const CLOSED_TOURNAMENT_KEPT_MS = 30 * DAY_MS;

/** What a check of the registrations found and did */
export interface LeagueRegistrationReport {
  teams: number;          // Linked teams read
  leagues: number;        // Local leagues read
  failed: number;         // Reads the site could not answer: their teams wait for the next night
  open: number;           // Teams and months of their league open to registration
  registered: number;     // ...the team is registered to
  openNotices: number;    // Teams told a registration opened
  closingNotices: number; // Teams told a registration closes soon
  removed: number;        // Months of leagues closed for a month, forgotten
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Whether the registration of a month is open at that moment: as the site says,
// and within its dates when it gives them
function isRegistrationOpen(tournament: LeagueTournament, now: Date): boolean {
  const { status, opensAt, closesAt } = tournament.registration;
  if (status !== 'open') return false;
  if (opensAt && Date.parse(opensAt) > now.getTime()) return false;
  return !closesAt || Date.parse(closesAt) > now.getTime();
}

// The local league a team plays in: the region of its latest tournament played
// at one of our venues
function leagueOf(tournaments: LeagueTournament[], venues: { id: string; name: string; slug: string }[]): string | null {
  const latestFirst = [...tournaments].sort((a, b) => (b.startsOn ?? '').localeCompare(a.startsOn ?? ''));
  return latestFirst.find(tournament => venueOfLeagueTournament(tournament, venues))?.region?.id ?? null;
}

/**
 * Read the registrations of our linked teams to their local league, and tell
 * those who manage a team not registered to a month open to registration:
 * when it opens, and once more three days before it closes. A month first
 * found in its last three days gets the last reminder alone. A read the site
 * cannot answer leaves its teams for the next night.
 */
export async function checkLeagueRegistrations(options: { now?: Date; pauseMs?: number } = {}): Promise<LeagueRegistrationReport> {
  const now = options.now ?? new Date();
  const pauseMs = options.pauseMs ?? LEAGUE_REGISTRATION_READ_PAUSE_MS;
  const report: LeagueRegistrationReport = { teams: 0, leagues: 0, failed: 0, open: 0, registered: 0, openNotices: 0, closingNotices: 0, removed: 0 };
  let reads = 0;
  const read = async <T>(call: () => Promise<T>): Promise<T | null> => {
    if (reads++ && pauseMs) await pause(pauseMs);
    try {
      return await call();
    } catch (error) {
      report.failed += 1;
      logger.warn('League registrations: competitive.eva.gg could not answer a read', error);
      return null;
    }
  };

  const venues = await prisma.venue.findMany({ select: { id: true, name: true, slug: true } });
  const teams = await prisma.team.findMany({
    where: { leagueTeamId: { not: null } },
    select: { id: true, leagueTeamId: true },
  });

  // Each linked team: the months it is registered to, and its league
  const followed: { teamId: string; leagueId: string; registered: Set<string> }[] = [];
  for (const team of teams) {
    const tournaments = await read(() => fetchLeagueTeamTournaments(team.leagueTeamId!));
    if (!tournaments) continue;
    report.teams += 1;
    const leagueId = leagueOf(tournaments, venues);
    if (leagueId) followed.push({ teamId: team.id, leagueId, registered: new Set(tournaments.map(tournament => tournament.id)) });
  }

  // Each league of those teams, once: its latest months and their registration
  const months = new Map<string, LeagueTournament[]>();
  for (const leagueId of new Set(followed.map(team => team.leagueId))) {
    const tournaments = await read(() => fetchLeagueRegionTournaments(leagueId));
    if (!tournaments) continue;
    report.leagues += 1;
    const ofLeague = tournaments.filter(tournament => tournament.region?.id === leagueId);
    months.set(leagueId, ofLeague);
    const forgottenBefore = now.getTime() - CLOSED_TOURNAMENT_KEPT_MS;
    for (const tournament of ofLeague) {
      // A month closed for longer than it is kept is not kept at all
      if (tournament.registration.closesAt && Date.parse(tournament.registration.closesAt) < forgottenBefore) continue;
      const kept = {
        name: tournament.name,
        regionId: leagueId,
        startsOn: tournament.startsOn ? new Date(tournament.startsOn) : null,
        registrationOpensAt: tournament.registration.opensAt ? new Date(tournament.registration.opensAt) : null,
        registrationClosesAt: tournament.registration.closesAt ? new Date(tournament.registration.closesAt) : null,
        seenAt: now,
      };
      await prisma.leagueTournament.upsert({ where: { id: tournament.id }, create: { id: tournament.id, ...kept }, update: kept });
    }
  }

  // Each team and month open to registration: registered or not, and what to tell
  for (const team of followed) {
    for (const tournament of months.get(team.leagueId) ?? []) {
      if (!isRegistrationOpen(tournament, now)) continue;
      report.open += 1;
      const isRegistered = team.registered.has(tournament.id);
      if (isRegistered) report.registered += 1;

      const key = { teamId_tournamentId: { teamId: team.teamId, tournamentId: tournament.id } };
      const before = await prisma.leagueEntry.findUnique({ where: key, select: { registeredAt: true, openNoticeAt: true, closingNoticeAt: true } });
      const registeredAt = isRegistered ? (before?.registeredAt ?? now) : null;
      let openNoticeAt = before?.openNoticeAt ?? null;
      let closingNoticeAt = before?.closingNoticeAt ?? null;

      if (!isRegistered && tournament.registration.closesAt) {
        const facts = { tournamentId: tournament.id, tournamentName: tournament.name, closesAt: tournament.registration.closesAt };
        const audience = { teamId: team.teamId, permission: { category: 'team', name: 'canManageTeam' } } as const;
        const closesSoon = Date.parse(tournament.registration.closesAt) - now.getTime() <= CLOSING_SOON_MS;
        if (closesSoon && !closingNoticeAt) {
          await notify({ kind: 'LEAGUE_REGISTRATION_CLOSING', data: facts }, audience);
          report.closingNotices += 1;
          closingNoticeAt = now;
          openNoticeAt ??= now;
        } else if (!closesSoon && !openNoticeAt) {
          await notify({ kind: 'LEAGUE_REGISTRATION_OPEN', data: facts }, audience);
          report.openNotices += 1;
          openNoticeAt = now;
        }
      }

      const entry = { registeredAt, openNoticeAt, closingNoticeAt, checkedAt: now };
      await prisma.leagueEntry.upsert({ where: key, create: { teamId: team.teamId, tournamentId: tournament.id, ...entry }, update: entry });
    }
  }

  const { count } = await prisma.leagueTournament.deleteMany({
    where: { registrationClosesAt: { lt: new Date(now.getTime() - CLOSED_TOURNAMENT_KEPT_MS) } },
  });
  report.removed = count;
  return report;
}
