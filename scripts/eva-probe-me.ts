// Read the private eva.gg data of the account whose token we hold
//
//PARKED Kept unplugged until the dedicated eva.gg account exists: the booking
// check needs exactly these queries (me, bookings by user id, orders), run with
// that account's token. Players never hand us their own token.
//
// Usage: EVA_TOKEN=<token> npm run eva:probe-me      (or EVA_TOKEN in .env)
//
// Exploration only, read only, on the account of whoever runs it: the token is
// the Bearer token eva.gg's web app sends on its own calls to
// api.eva.gg/graphql (visible in the browser's network tab). It is read from
// the environment, never stored, never printed. The output is the raw JSON
// eva.gg returns, so we can design how we check that a player's slot is booked.

import 'dotenv/config';
import { evaGraphql } from '../server/src/integrations/eva/eva-graphql';

// Operation names and field lists mirror what app.eva.gg itself asks for.

const ME_QUERY = `
  query me {
    me {
      id
      username
      displayName
      fullName
      firstName
      lastName
      email
      emailConfirmed
      phone
      birthdate
      gender
      language
      createdAt
      role
      isPublic
      abilities
      eSportEnabled
      eSportExpiresAt
      eSportLocationIdList
      usernameToken
      referralCode
      authorization { actions }
      player {
        id
        experience { level }
      }
    }
  }
`;

const BOOKING_FIELDS = `
  id
  locationId
  terrainId
  gameId
  status
  seatCount
  userIds
  orderId
  bookingGroupUnitId
  isESport
  isBattlepass
  isReschedulable
  hasEnded
  timezone
  sessionLink
  slot {
    id
    date
    datetime
    localDatetime
    convocationLocalDatetime
    endLocalDatetime
    startTime
    endTime
    duration
    weekDay
    hasEnded
  }
  schedule { status checked }
  game { id name identifier isCompetitiveModeAvailable }
  location { id identifier name department country status }
  terrain { id displayNumber }
  user { id username displayName email }
  bookingGroupUnit {
    id
    status
    seatCount
    filledSeatCount
    leftSeatCount
    isCompetitiveMode
    shareLink
    participants {
      id
      userId
      paidSeatCount
      level
      username { username displayName fullName }
    }
    group {
      id
      paymentDetails { status }
    }
  }
`;

// The same list their staff screens use, narrowed to one user
const MY_BOOKINGS_QUERY = `
  query listBooking($userId: Int!, $page: Int) {
    bookings(userId: $userId, page: $page) {
      nodes { ${BOOKING_FIELDS} }
      totalCount
      pageInfo { current total itemsLimit }
    }
  }
`;

// Scoped to the caller by the API itself, so it answers even if the list
// above is reserved to their staff
const MY_ORDERS_QUERY = `
  query getMyOrderList($page: Int!) {
    myOrders(page: $page) {
      totalCount
      pageInfo { current total itemsLimit }
      nodes {
        id
        uuid
        type
        status
        origin
        createdAt
        expiresAt
        userId
        userIds
        currency
        paidAmount
        leftToPayAmount
        items { id quantity unitPrice createdAt }
      }
    }
  }
`;

interface Me {
  id: number;
  username: string | null;
  displayName: string | null;
  email: string | null;
}

interface Page<T> {
  nodes: T[];
  totalCount: number;
  pageInfo: { current: number; total: number; itemsLimit: number };
}

interface Booking {
  id: number;
  status: string;
  seatCount: number;
  hasEnded: boolean;
  slot: { localDatetime: string } | null;
  location: { name: string } | null;
  terrain: { displayNumber: number | string } | null;
  bookingGroupUnit: { filledSeatCount: number; seatCount: number } | null;
}

function section(title: string, value: unknown) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
}

/**
 * Walk a paginated list until eva.gg says there is no next page
 */
async function fetchAllPages<T>(
  query: string,
  variables: Record<string, unknown>,
  pick: (data: Record<string, unknown>) => Page<T>,
  token: string,
): Promise<T[]> {
  const nodes: T[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const data = await evaGraphql<Record<string, unknown>>(query, { ...variables, page }, { token });
    const result = pick(data);
    nodes.push(...result.nodes);
    lastPage = result.pageInfo.total;
    page++;
  } while (page <= lastPage);

  return nodes;
}

async function main() {
  const token = process.env.EVA_TOKEN?.trim();
  if (!token) {
    console.error(
      'EVA_TOKEN manquant.\n' +
      'Dans app.eva.gg connecté, onglet Réseau des outils de développement : copier la valeur du\n' +
      "header « authorization » (sans le préfixe « Bearer ») d'un appel à api.eva.gg/graphql,\n" +
      'puis la mettre dans .env sous EVA_TOKEN=… (fichier ignoré par git).',
    );
    process.exitCode = 1;
    return;
  }

  // Who am I: the fields we could match a player on
  const { me } = await evaGraphql<{ me: Me }>(ME_QUERY, {}, { token });
  section('me', me);

  // My bookings, through the generic list filtered on my own id
  try {
    const bookings = await fetchAllPages<Booking>(
      MY_BOOKINGS_QUERY,
      { userId: me.id },
      data => data.bookings as Page<Booking>,
      token,
    );
    section(`bookings (userId: ${me.id}) — ${bookings.length} au total`, bookings);

    const upcoming = bookings.filter(booking => !booking.hasEnded);
    console.log(`\n--- ${upcoming.length} réservation(s) à venir ---`);
    for (const booking of upcoming) {
      const unit = booking.bookingGroupUnit;
      const seats = unit ? `${unit.filledSeatCount}/${unit.seatCount} places` : `${booking.seatCount} place(s)`;
      console.log(
        `  ${booking.slot?.localDatetime ?? '?'}  ${booking.location?.name ?? '?'}` +
        `  arène ${booking.terrain?.displayNumber ?? '?'}  ${seats}  [${booking.status}]`,
      );
    }
  } catch (error) {
    console.error(`\nbookings(userId) refusé : ${error instanceof Error ? error.message : error}`);
  }

  // My orders, the list eva.gg scopes to the caller itself
  try {
    const { myOrders } = await evaGraphql<{ myOrders: Page<unknown> }>(MY_ORDERS_QUERY, { page: 1 }, { token });
    section(`myOrders — ${myOrders.totalCount} au total, page 1/${myOrders.pageInfo.total}`, myOrders.nodes);
  } catch (error) {
    console.error(`\nmyOrders refusé : ${error instanceof Error ? error.message : error}`);
  }
}

main().catch(error => {
  console.error(`\nÉchec : ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
