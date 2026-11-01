// Tests for reading a venue's sessions from eva.gg
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLocationSessions } from '../../../server/src/integrations/eva/eva-sessions';
import { EvaApiError } from '../../../server/src/integrations/eva/eva-graphql';

// Two sessions as eva.gg answered for Nîmes on 2026-11-03, narrowed to the fields we ask for
function session(startTime: string, convocationTime: string, overrides: Record<string, unknown> = {}) {
  return {
    takenSeatCount: 0,
    totalSeatCount: 10,
    slot: { id: `slot-${startTime}`, startTime, convocationTime, duration: 40 },
    terrain: { displayNumber: 1 },
    competitiveMode: { isAvailable: true },
    ...overrides,
  };
}

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

describe('fetchLocationSessions', () => {
  it('asks for every competitive-game session of the location that day, as a visitor would', async () => {
    const fetchMock = stubFetch({ data: { listLocationGameSessionsByDate: [] } });

    await fetchLocationSessions(51, '2026-11-03');

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).variables).toEqual({
      data: {
        date: '2026-11-03',
        locationId: 51,
        seatCount: 1,
        seatTypes: ['PLAYER'],
        isCompetitiveModeOnly: false,
        gameIdList: [1],
      },
    });
  });

  it('turns a session into a slot with its end time and arena', async () => {
    stubFetch({
      data: {
        listLocationGameSessionsByDate: [
          session('20:00', '19:50', { takenSeatCount: 7 }),
        ],
      },
    });

    expect(await fetchLocationSessions(51, '2026-11-03')).toEqual([{
      slotId: 'slot-20:00',
      startTime: '20:00',
      endTime: '20:40',
      convocationTime: '19:50',
      arenaNumber: 1,
      takenSeats: 7,
      totalSeats: 10,
      isCompetitiveAvailable: true,
    }]);
  });

  it('orders slots by start time then arena, whatever order eva.gg used', async () => {
    stubFetch({
      data: {
        listLocationGameSessionsByDate: [
          session('20:40', '20:30', { terrain: { displayNumber: '2' } }),
          session('20:00', '19:50', { terrain: { displayNumber: 2 } }),
          session('20:00', '19:50', { terrain: { displayNumber: 1 } }),
        ],
      },
    });

    const slots = await fetchLocationSessions(51, '2026-11-03');

    expect(slots.map(s => `${s.startTime}/${s.arenaNumber}`)).toEqual(['20:00/1', '20:00/2', '20:40/2']);
  });

  it('answers with no slot when the venue is closed that day', async () => {
    stubFetch({ data: { listLocationGameSessionsByDate: [] } });
    expect(await fetchLocationSessions(51, '2026-12-25')).toEqual([]);

    stubFetch({ data: { listLocationGameSessionsByDate: null } });
    expect(await fetchLocationSessions(51, '2026-12-25')).toEqual([]);
  });

  it('treats a missing competitive mode as unavailable', async () => {
    stubFetch({ data: { listLocationGameSessionsByDate: [session('14:00', '13:50', { competitiveMode: null })] } });

    expect((await fetchLocationSessions(51, '2026-11-03'))[0]!.isCompetitiveAvailable).toBe(false);
  });

  it('lets a failure through so the caller can tell eva.gg is down', async () => {
    stubFetch({}, { ok: false, status: 503 });

    await expect(fetchLocationSessions(51, '2026-11-03')).rejects.toBeInstanceOf(EvaApiError);
  });
});
