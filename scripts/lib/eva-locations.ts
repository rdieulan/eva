// Venues as listed by the eva.gg public API
//
// eva.gg is the operator that runs the arenas our teams play in, and its API
// is the source of truth for their names, addresses and phone numbers.

const EVA_GRAPHQL_URL = 'https://api.eva.gg/graphql';

// Their edge only answers calls coming from their own web app, so a request
// without this header is turned away with a 403.
const EVA_APP_ORIGIN = 'https://app.eva.gg';

// "EVA BATTLE ARENA" (AFTER_H_BATTLE_ARENA), the competitive game our teams
// play. A venue also runs arenas for their other games, which we ignore.
const COMPETITIVE_GAME_ID = 1;

const LIST_LOCATIONS_QUERY = `
  query ListLocations($country: CountryEnum!) {
    listLocations(country: $country, sortOrder: { by: DEPARTMENT }) {
      id
      name
      isClosed
      telephone
      address {
        street
        city
      }
      details {
        terrains {
          id
          games { gameId }
        }
      }
    }
  }
`;

export interface EvaLocation {
  id: number;
  name: string;
  isClosed: boolean;
  telephone: string | null;
  address: { street: string | null; city: string | null } | null;
  details: { terrains: { id: number; games: { gameId: number }[] }[] };
}

export interface VenueInput {
  externalId: number;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  arenaCount: number;
}

export interface MappingResult {
  venues: VenueInput[];
  skipped: { name: string; reason: string }[];
}

/**
 * How many arenas a location runs for the competitive game. Venues always have
 * at least one, so a location that somehow lists none still counts as one.
 */
function countCompetitiveArenas(location: EvaLocation): number {
  const arenas = location.details.terrains.filter(
    terrain => terrain.games.some(game => game.gameId === COMPETITIVE_GAME_ID),
  );
  return Math.max(arenas.length, 1);
}

/**
 * Turn the locations of a country into venues we can store.
 * A location we cannot store is reported rather than filled with invented data.
 */
export function toVenues(locations: EvaLocation[]): MappingResult {
  const result: MappingResult = { venues: [], skipped: [] };

  for (const location of locations) {
    const name = location.name.trim();
    const street = location.address?.street?.trim();

    if (location.isClosed) {
      result.skipped.push({ name, reason: 'fermée' });
      continue;
    }
    if (!street) {
      result.skipped.push({ name, reason: 'adresse absente' });
      continue;
    }

    result.venues.push({
      externalId: location.id,
      name,
      // A few locations come without a city; they are named after the town they
      // are in, so the name is the closest true value we have.
      city: location.address?.city?.trim() || name,
      address: street,
      phone: location.telephone?.trim() || null,
      arenaCount: countCompetitiveArenas(location),
    });
  }

  return result;
}

/**
 * Fetch the locations eva.gg runs in a country (ISO code, e.g. FR)
 */
export async function fetchEvaLocations(country: string): Promise<EvaLocation[]> {
  const response = await fetch(EVA_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: EVA_APP_ORIGIN },
    body: JSON.stringify({ query: LIST_LOCATIONS_QUERY, variables: { country } }),
  });

  if (!response.ok) {
    throw new Error(`eva.gg a répondu ${response.status} ${response.statusText}`);
  }

  const body = await response.json() as {
    data?: { listLocations?: EvaLocation[] };
    errors?: { message: string }[];
  };

  if (body.errors?.length) {
    throw new Error(`eva.gg a renvoyé une erreur : ${body.errors.map(e => e.message).join(', ')}`);
  }
  if (!body.data?.listLocations) {
    throw new Error('Réponse inattendue de eva.gg : pas de liste de salles');
  }

  return body.data.listLocations;
}
