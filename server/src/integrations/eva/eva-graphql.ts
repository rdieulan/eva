// Calls to the eva.gg GraphQL API
//
// eva.gg is the operator that runs the arenas our teams play in. Their API
// serves public data (venues, public player profiles) without a token, and
// private data (bookings) with one.
//
// No path aliases in this directory: the scripts under scripts/ load these
// files with tsx, which does not resolve them.

const EVA_GRAPHQL_URL = 'https://api.eva.gg/graphql';

// Their edge only answers calls coming from their own web app, so a request
// without this header is turned away with a 403.
const EVA_APP_ORIGIN = 'https://app.eva.gg';

export interface EvaGraphqlOptions {
  // Access token sent as a Bearer token exactly as their web app does. Omit it
  // for public queries. Players never hand us their own token: private data is
  // read through one dedicated account whose token lives in the environment.
  token?: string;
}

export interface EvaGraphqlError {
  message: string;
  path?: (string | number)[];
  // eva.gg puts a machine-readable code here (e.g. USER_NOT_FOUND)
  extensions?: { code?: string } & Record<string, unknown>;
}

/**
 * A call eva.gg refused or could not answer. Carries the GraphQL errors so a
 * caller can tell a business refusal (by its code) from an outage.
 */
export class EvaApiError extends Error {
  readonly graphqlErrors: EvaGraphqlError[];
  readonly status: number | null;

  constructor(message: string, graphqlErrors: EvaGraphqlError[] = [], status: number | null = null) {
    super(message);
    this.name = 'EvaApiError';
    this.graphqlErrors = graphqlErrors;
    this.status = status;
  }

  /**
   * Whether eva.gg answered with this error code
   */
  hasCode(code: string): boolean {
    return this.graphqlErrors.some(error => error.extensions?.code === code);
  }
}

/**
 * Run one GraphQL operation against eva.gg and return its `data`.
 * A transport failure or a GraphQL error is thrown as an EvaApiError carrying
 * eva.gg's own message.
 */
export async function evaGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: EvaGraphqlOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: EVA_APP_ORIGIN,
  };
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(EVA_GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new EvaApiError(`eva.gg a répondu ${response.status} ${response.statusText}`, [], response.status);
  }

  const body = await response.json() as { data?: T; errors?: EvaGraphqlError[] };

  if (body.errors?.length) {
    throw new EvaApiError(
      `eva.gg a renvoyé une erreur : ${body.errors.map(e => e.message).join(', ')}`,
      body.errors,
      response.status,
    );
  }
  if (body.data === undefined || body.data === null) {
    throw new EvaApiError('Réponse inattendue de eva.gg : pas de données', [], response.status);
  }

  return body.data;
}
