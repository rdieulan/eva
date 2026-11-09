// The development login: act as any account of the local database without
// Discord, to check the app with the demo teams. It exists only when asked
// for (DEV_LOGIN=true) and never in production, whatever is set: the routes
// are not even mounted there. Even then it answers the local machine only: a
// development server listens on every interface of a shared network.

import { prisma } from '@db/prisma';
import type { DevLoginAccount } from '@shared/types';
import { accountRoles } from '@services/auth.service';

/** Whether this server offers the development login */
export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === 'true';
}

// The addresses of this very machine, as the socket sees them (not the
// forwarded headers, which a client writes as it likes)
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Whether a request comes from this very machine (the Vite server, a local browser) */
export function isLocalRequest(remoteAddress: string | undefined): boolean {
  return remoteAddress !== undefined && LOOPBACK.has(remoteAddress);
}

/** The accounts to act as: team by team, then by name */
export async function listDevLoginAccounts(): Promise<DevLoginAccount[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      managerId: true,
      adminId: true,
      player: { select: { team: { select: { name: true } } } },
    },
  });

  return users
    .map(user => ({
      id: user.id,
      name: user.name,
      teamName: user.player.team?.name ?? null,
      roles: accountRoles(user),
    }))
    // The accounts without a team come last
    .sort((a, b) => Number(a.teamName === null) - Number(b.teamName === null)
      || (a.teamName ?? '').localeCompare(b.teamName ?? '')
      || a.name.localeCompare(b.name));
}

/** Whether an account exists, to act as it */
export async function devLoginAccountExists(userId: string): Promise<boolean> {
  return (await prisma.user.count({ where: { id: userId } })) > 0;
}
