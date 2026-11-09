// Signing in with Discord: whether this server can, and what a sign-in does to
// the accounts. A Discord account is one person: their first sign-in makes
// their account, a player, named after their Discord name; an invitation adds
// its role, and the session then acts as that role.

import { Prisma } from '@prisma/client';
import type { AccountRole } from '@prisma/client';
import { prisma } from '@db/prisma';
import { normalizeName, validateName } from '@shared/utils';
import { appUrl } from '@utils/app-url';
import type { DiscordIdentity, DiscordOAuthConfig } from '../integrations/discord/discord-oauth';
import { acceptInvitation } from '@services/invitation.service';
import type { InvitationError } from '@services/invitation.service';

/**
 * The Discord application this server signs in with, and where Discord sends
 * the visitor back; null when it is not set up (DISCORD_CLIENT_ID,
 * DISCORD_CLIENT_SECRET, APP_URL)
 */
export function discordLoginConfig(): DiscordOAuthConfig | null {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  const base = appUrl();
  if (!clientId || !clientSecret || !base) return null;
  return { clientId, clientSecret, redirectUri: `${base}/api/auth/discord/callback` };
}

/**
 * The name an account starts with: the name shown on Discord, else the
 * Discord handle; one that breaks our rule (a line break, say) makes way for
 * a plain "Joueur" and the end of the account's number, to be changed on the profile
 */
export function startingName(identity: DiscordIdentity): string {
  for (const candidate of [identity.globalName, identity.username]) {
    if (candidate && validateName(candidate) === true) return normalizeName(candidate);
  }
  return `Joueur ${identity.id.slice(-4)}`;
}

// The account of a Discord account, made at its first sign-in
async function accountOf(identity: DiscordIdentity): Promise<string> {
  const select = { id: true } as const;
  try {
    const user = await prisma.user.upsert({
      where: { discordId: identity.id },
      create: { discordId: identity.id, name: startingName(identity), player: { create: {} } },
      update: {},
      select,
    });
    return user.id;
  } catch (error) {
    // Two first sign-ins at once: the other one made the account
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return (await prisma.user.findUniqueOrThrow({ where: { discordId: identity.id }, select })).id;
    }
    throw error;
  }
}

export type SignInOutcome = { userId: string; role: AccountRole } | { error: InvitationError };

/** What a sign-in does: the person's account, and the role their invitation gives, if any */
export async function signInWithDiscord(identity: DiscordIdentity, invitation: string | null): Promise<SignInOutcome> {
  const userId = await accountOf(identity);
  if (!invitation) return { userId, role: 'PLAYER' };

  const accepted = await acceptInvitation(invitation, userId);
  return isInvitationError(accepted) ? { error: accepted } : { userId, role: accepted };
}

function isInvitationError(outcome: AccountRole | InvitationError): outcome is InvitationError {
  return outcome === 'invalid' || outcome === 'expired' || outcome === 'roleTaken';
}
