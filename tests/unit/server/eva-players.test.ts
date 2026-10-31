// Tests for looking up a public eva.gg player by tag
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPublicPlayerByUsername } from '../../../server/src/integrations/eva/eva-players';
import { EvaApiError } from '../../../server/src/integrations/eva/eva-graphql';

function stubFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: '',
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPublicPlayerByUsername', () => {
  it('asks eva.gg for the tag as given and returns the account behind it', async () => {
    const fetchMock = stubFetch({
      data: {
        getPublicPlayerByUsername: {
          id: 99,
          user: { id: 202617, username: 'Sib#202617', displayName: 'Sib' },
        },
      },
    });

    const lookup = await fetchPublicPlayerByUsername('Sib#202617');

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).variables).toEqual({ username: 'Sib#202617' });
    expect(lookup).toEqual({ player: { userId: 202617, username: 'Sib#202617', displayName: 'Sib' } });
  });

  it('reports a tag nobody has, whether eva.gg says so with null or with its error code', async () => {
    stubFetch({ data: { getPublicPlayerByUsername: null } });
    expect(await fetchPublicPlayerByUsername('Nobody#000000')).toEqual({ miss: 'notFound' });

    stubFetch({ errors: [{ message: 'not found', extensions: { code: 'USER_NOT_FOUND' } }] });
    expect(await fetchPublicPlayerByUsername('Nobody#000000')).toEqual({ miss: 'notFound' });
  });

  it('reports a profile its owner keeps private', async () => {
    stubFetch({ errors: [{ message: 'private', extensions: { code: 'PRIVATE_USER_PROFILE' } }] });

    expect(await fetchPublicPlayerByUsername('Shy#123456')).toEqual({ miss: 'privateProfile' });
  });

  it('lets any other failure through so the caller can tell eva.gg is down', async () => {
    stubFetch({}, { ok: false, status: 503 });

    await expect(fetchPublicPlayerByUsername('Sib#202617')).rejects.toBeInstanceOf(EvaApiError);
  });
});
