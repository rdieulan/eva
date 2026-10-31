// Tests for the eva.gg GraphQL client
import { describe, it, expect, vi, afterEach } from 'vitest';
import { evaGraphql, EvaApiError } from '../../../server/src/integrations/eva/eva-graphql';

function stubFetch(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('evaGraphql', () => {
  it('posts the operation to eva.gg as their own web app would', async () => {
    const fetchMock = stubFetch({ data: { ok: true } });

    await evaGraphql('query { ok }', { a: 1 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.eva.gg/graphql');
    expect(init.method).toBe('POST');
    expect(init.headers.origin).toBe('https://app.eva.gg');
    expect(init.headers.authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ query: 'query { ok }', variables: { a: 1 } });
  });

  it('sends the token as a Bearer token when given one', async () => {
    const fetchMock = stubFetch({ data: {} });

    await evaGraphql('query { me }', {}, { token: 'abc' });

    expect(fetchMock.mock.calls[0]![1].headers.authorization).toBe('Bearer abc');
  });

  it('returns the data of a successful operation', async () => {
    stubFetch({ data: { listLocations: [{ id: 1 }] } });

    await expect(evaGraphql('query { listLocations { id } }')).resolves.toEqual({ listLocations: [{ id: 1 }] });
  });

  it('throws with the HTTP status when the edge turns the call away', async () => {
    stubFetch({}, { ok: false, status: 403, statusText: 'Forbidden' });

    const error = await evaGraphql('query { ok }').catch(e => e);

    expect(error).toBeInstanceOf(EvaApiError);
    expect(error.status).toBe(403);
    expect(error.message).toContain('403');
  });

  it('throws with the GraphQL errors and their codes', async () => {
    stubFetch({
      data: null,
      errors: [{ message: 'User not found', extensions: { code: 'USER_NOT_FOUND' } }],
    });

    const error = await evaGraphql('query { ok }').catch(e => e);

    expect(error).toBeInstanceOf(EvaApiError);
    expect(error.message).toContain('User not found');
    expect(error.hasCode('USER_NOT_FOUND')).toBe(true);
    expect(error.hasCode('FORBIDDEN')).toBe(false);
  });

  it('throws when eva.gg answers without data', async () => {
    stubFetch({});

    await expect(evaGraphql('query { ok }')).rejects.toBeInstanceOf(EvaApiError);
  });
});
