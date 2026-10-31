// Public player profiles on eva.gg
//
// A player is found by their eva.gg tag, the "Pseudo#123456" shown on their
// eva.gg account page. The tag is unique at any given time but eva.gg issues a
// new one whenever the player renames, so the stable identity is the user id.

import { evaGraphql, EvaApiError } from './eva-graphql';

// Codes eva.gg attaches (extensions.code) when a public profile lookup is refused
const EVA_USER_NOT_FOUND = 'USER_NOT_FOUND';
const EVA_PRIVATE_USER_PROFILE = 'PRIVATE_USER_PROFILE';

// Mirrors the PlayerFields fragment of app.eva.gg, narrowed to identity
const PUBLIC_PLAYER_QUERY = `
  query getPublicPlayerByUsername($username: String!) {
    getPublicPlayerByUsername(username: $username) {
      id
      user {
        id
        username
        displayName
      }
    }
  }
`;

interface PublicPlayerData {
  getPublicPlayerByUsername: {
    id: number;
    user: { id: number; username: string; displayName: string | null } | null;
  } | null;
}

export interface EvaPublicPlayer {
  userId: number;
  username: string;
  displayName: string | null;
}

// Why a lookup gave no player: no such tag, or a profile its owner keeps private
export type PublicPlayerMiss = 'notFound' | 'privateProfile';

export type PublicPlayerLookup = { player: EvaPublicPlayer } | { miss: PublicPlayerMiss };

/**
 * Find the public profile behind an eva.gg tag, without any token.
 * Throws an EvaApiError when eva.gg cannot be reached or refuses for another reason.
 */
export async function fetchPublicPlayerByUsername(username: string): Promise<PublicPlayerLookup> {
  let data: PublicPlayerData;
  try {
    data = await evaGraphql<PublicPlayerData>(PUBLIC_PLAYER_QUERY, { username });
  } catch (error) {
    if (error instanceof EvaApiError) {
      if (error.hasCode(EVA_USER_NOT_FOUND)) return { miss: 'notFound' };
      if (error.hasCode(EVA_PRIVATE_USER_PROFILE)) return { miss: 'privateProfile' };
    }
    throw error;
  }

  const player = data.getPublicPlayerByUsername;
  if (!player?.user) return { miss: 'notFound' };

  return {
    player: {
      userId: player.user.id,
      username: player.user.username,
      displayName: player.user.displayName,
    },
  };
}
