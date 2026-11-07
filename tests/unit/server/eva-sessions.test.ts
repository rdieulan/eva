// Tests for reading a venue's sessions from eva.gg
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLocationSessions } from '../../../server/src/integrations/eva/eva-sessions';
import { EvaApiError } from '../../../server/src/integrations/eva/eva-graphql';

// Sessions as eva.gg answered for Nîmes on 2026-11-03, narrowed to the fields we ask for
function session(startTime: string, convocationTime: string, overrides: Record<string, unknown> = {}) {
  return {
    takenSeatCount: 0,
    totalSeatCount: 10,
    slot: { id: `slot-${startTime}`, startTime, convocationTime, duration: 40 },
    terrain: { displayNumber: 1 },
    game: { id: 1 },
    competitiveMode: { isAvailable: true },
    pricingType: 'OFF_PEAK_HOUR',
    subscriptionPricingType: 'OFF_PEAK_HOUR',
    subscriptionThreshold: { mustDeduct: false, countLeftDaily: 0 },
    ...overrides,
  };
}

// A peak session as eva.gg answered for Nîmes on Saturday 2026-11-07: it counts
// against the venue's pass quota of the day, 14 sessions left
function peakSession(startTime: string, convocationTime: string, overrides: Record<string, unknown> = {}) {
  return session(startTime, convocationTime, {
    pricingType: 'PEAK_HOUR',
    subscriptionPricingType: 'PEAK_HOUR',
    subscriptionThreshold: { mustDeduct: true, countLeftDaily: 14 },
    ...overrides,
  });
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
  it('asks for every session of the location that day, whatever the game, as a visitor would', async () => {
    const fetchMock = stubFetch({ data: { listLocationGameSessionsByDate: [] } });

    await fetchLocationSessions(51, '2026-11-03');

    // The rates and the pass quota come with the slots, in the same call
    const query: string = JSON.parse(fetchMock.mock.calls[0]![1].body).query;
    expect(query).toContain('subscriptionPricingType');
    expect(query).toMatch(/subscriptionThreshold\s*{\s*mustDeduct\s+countLeftDaily\s*}/);

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).variables).toEqual({
      data: {
        date: '2026-11-03',
        locationId: 51,
        seatCount: 1,
        seatTypes: ['PLAYER'],
        isCompetitiveModeOnly: false,
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
      slotId: 'slot-20:00-1',
      startTime: '20:00',
      endTime: '20:40',
      convocationTime: '19:50',
      arenaNumber: 1,
      gameId: 1,
      takenSeats: 7,
      totalSeats: 10,
      isCompetitiveAvailable: true,
      tokenType: 'offPeak',
      passQuotaLeft: null,
    }]);
  });

  it('says which token a pass holder spends, a good deal costing an off-peak one, an hour of neither kind none', async () => {
    stubFetch({
      data: {
        listLocationGameSessionsByDate: [
          session('14:00', '13:50', { pricingType: 'GOOD_DEAL_HOUR', subscriptionPricingType: 'GOOD_DEAL_HOUR' }),
          session('16:40', '16:30'),
          peakSession('20:00', '19:50'),
          session('22:00', '21:50', { pricingType: 'NORMAL', subscriptionPricingType: 'NORMAL' }),
        ],
      },
    });

    const slots = await fetchLocationSessions(51, '2026-11-07');

    expect(slots.map(slot => [slot.startTime, slot.tokenType])).toEqual([
      ['14:00', 'offPeak'],
      ['16:40', 'offPeak'],
      ['20:00', 'peak'],
      ['22:00', null],
    ]);
  });

  it('reads the rate a pass holder gets before the visitor\'s', async () => {
    stubFetch({ data: { listLocationGameSessionsByDate: [session('20:00', '19:50', { pricingType: 'PEAK_HOUR', subscriptionPricingType: 'OFF_PEAK_HOUR' })] } });
    expect((await fetchLocationSessions(51, '2026-11-07'))[0]!.tokenType).toBe('offPeak');

    stubFetch({ data: { listLocationGameSessionsByDate: [session('20:00', '19:50', { pricingType: 'PEAK_HOUR', subscriptionPricingType: null })] } });
    expect((await fetchLocationSessions(51, '2026-11-07'))[0]!.tokenType).toBe('peak');
  });

  it('carries the venue\'s pass quota of the day on the slots that count against it', async () => {
    stubFetch({
      data: {
        listLocationGameSessionsByDate: [
          session('12:00', '11:50', { subscriptionThreshold: { mustDeduct: false, countLeftDaily: 14 } }),
          peakSession('20:00', '19:50'),
          peakSession('20:40', '20:30', { subscriptionThreshold: { mustDeduct: true, countLeftDaily: 0 } }),
          session('22:00', '21:50', { subscriptionThreshold: null }),
        ],
      },
    });

    const slots = await fetchLocationSessions(51, '2026-11-07');

    expect(slots.map(slot => [slot.startTime, slot.passQuotaLeft])).toEqual([
      ['12:00', null],
      ['20:00', 14],
      ['20:40', 0],
      ['22:00', null],
    ]);
  });

  it('folds the games sharing an arena and a time into one slot, held by ours while nobody booked', async () => {
    stubFetch({
      data: {
        listLocationGameSessionsByDate: [
          session('18:00', '17:50', { game: { id: 10 }, competitiveMode: { isAvailable: false } }),
          session('18:00', '17:50', { game: { id: 1 } }),
          session('18:00', '17:50', { game: { id: '5' }, competitiveMode: { isAvailable: false } }),
        ],
      },
    });

    const slots = await fetchLocationSessions(51, '2026-11-03');

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ startTime: '18:00', gameId: 1, isCompetitiveAvailable: true, takenSeats: 0 });
  });

  it('hands the slot to the game that has players in it', async () => {
    stubFetch({
      data: {
        listLocationGameSessionsByDate: [
          session('18:00', '17:50', { game: { id: 1 } }),
          session('18:00', '17:50', { game: { id: 10 }, takenSeatCount: 4, competitiveMode: { isAvailable: false } }),
        ],
      },
    });

    const slots = await fetchLocationSessions(51, '2026-11-03');

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ gameId: 10, takenSeats: 4 });
  });

  it('keeps a slot listed for another game only', async () => {
    stubFetch({ data: { listLocationGameSessionsByDate: [session('18:00', '17:50', { game: { id: '7' } })] } });

    expect((await fetchLocationSessions(51, '2026-11-03'))[0]!.gameId).toBe(7);
  });

  it('tells the arenas of an hour apart: eva.gg\'s slot id names the hour, the same on each arena', async () => {
    stubFetch({
      data: {
        listLocationGameSessionsByDate: [
          session('20:00', '19:50', { terrain: { displayNumber: 1 } }),
          session('20:00', '19:50', { terrain: { displayNumber: 2 }, takenSeatCount: 4 }),
        ],
      },
    });

    const slots = await fetchLocationSessions(68, '2026-11-03');

    expect(slots.map(s => [s.slotId, s.arenaNumber, s.takenSeats])).toEqual([['slot-20:00-1', 1, 0], ['slot-20:00-2', 2, 4]]);
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
