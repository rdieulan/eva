// A failed answer does not always carry our JSON: the proxy in front of the API
// answers an empty body when it cannot reach it. The client must still tell the
// user what failed, in its own words.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, readJsonBody } from '@/api/error';
import { authFetch } from '@/api/utils';
import { ERROR } from '@shared/constants';

function answer(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

describe('readJsonBody', () => {
  it('reads our error payload', async () => {
    await expect(readJsonBody(answer(400, '{"errors":["Date invalide"]}'))).resolves.toEqual({ errors: ['Date invalide'] });
  });

  it('reads an empty, HTML or non-object body as nothing', async () => {
    await expect(readJsonBody(answer(500, ''))).resolves.toEqual({});
    await expect(readJsonBody(answer(502, '<html>Bad Gateway</html>'))).resolves.toEqual({});
    await expect(readJsonBody(answer(500, '"oops"'))).resolves.toEqual({});
  });
});

describe('ApiError.fromFailedResponse', () => {
  it('keeps the server errors when there are some', async () => {
    const error = await ApiError.fromFailedResponse(answer(400, '{"errors":["Date invalide"]}'), ERROR.availabilityUpdateFailed);
    expect(error.errors).toEqual(['Date invalide']);
    expect(error.message).toBe('Date invalide');
  });

  it('falls back to the caller message on an empty body', async () => {
    const error = await ApiError.fromFailedResponse(answer(500, ''), ERROR.availabilityUpdateFailed);
    expect(error.errors).toEqual([ERROR.availabilityUpdateFailed]);
  });
});

describe('authFetch with a failure message', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws the caller message, not a JSON parsing error, when the proxy answers an empty 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(500, '')));
    vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => undefined });

    await expect(authFetch('/api/calendar/availability', { method: 'POST' }, ERROR.availabilityUpdateFailed))
      .rejects.toMatchObject({ name: 'ApiError', message: ERROR.availabilityUpdateFailed });
  });

  it('throws the caller message when a success comes back without a body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(200, '')));
    vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => undefined });

    await expect(authFetch('/api/calendar/availability', { method: 'POST' }, ERROR.availabilityUpdateFailed))
      .rejects.toMatchObject({ name: 'ApiError', message: ERROR.availabilityUpdateFailed });
  });

  it('still hands over the server errors of a failed answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(400, '{"errors":["Date invalide"]}')));
    vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => undefined });

    await expect(authFetch('/api/calendar/availability', { method: 'POST' }, ERROR.availabilityUpdateFailed))
      .rejects.toMatchObject({ name: 'ApiError', message: 'Date invalide' });
  });
});
