// Integration tests - Venues routes (slots of a day, read from eva.gg)
//
// eva.gg is never called: the sessions lookup is mocked so each test decides
// how eva.gg answers.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { createAuthenticatedUser } from './helpers/auth';
import { prisma } from './helpers/db';
import { ERROR } from '@shared/constants/error.constants';
import { fetchLocationSessions } from '../../server/src/integrations/eva/eva-sessions';
import { EvaApiError } from '../../server/src/integrations/eva/eva-graphql';
import { clearVenueSlotsCache } from '../../server/src/services/venue-slots.service';

vi.mock('../../server/src/integrations/eva/eva-sessions', () => ({
  fetchLocationSessions: vi.fn(),
}));

const sessions = vi.mocked(fetchLocationSessions);

const NIMES = { id: 'venue-nimes', name: 'Nîmes', city: 'Nimes', address: '1 rue', externalId: 51 };
const HAND_MADE = { id: 'venue-hand', name: 'Garage', city: 'Paris', address: '2 rue' };

const SLOT_20H = {
  slotId: 'slot-20:00',
  startTime: '20:00',
  endTime: '20:40',
  convocationTime: '19:50',
  arenaNumber: 1,
  takenSeats: 7,
  totalSeats: 10,
  isCompetitiveAvailable: true,
};

beforeEach(async () => {
  sessions.mockReset();
  clearVenueSlotsCache();
  await prisma.venue.createMany({ data: [NIMES, HAND_MADE] });
});

describe('GET /api/venues/:id/slots', () => {
  it('should list the slots eva.gg runs at the venue that day', async () => {
    const { token } = await createAuthenticatedUser();
    sessions.mockResolvedValue([SLOT_20H]);

    const res = await request(app)
      .get(`/api/venues/${NIMES.id}/slots`)
      .query({ date: '2026-11-03' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{
      slotId: 'slot-20:00',
      startTime: '20:00',
      endTime: '20:40',
      convocationTime: '19:50',
      arenaNumber: 1,
      takenSeats: 7,
      totalSeats: 10,
    }]);
    expect(sessions).toHaveBeenCalledWith(51, '2026-11-03');
  });

  it('should ask eva.gg once per venue and day while the answer is fresh', async () => {
    const { token } = await createAuthenticatedUser();
    sessions.mockResolvedValue([SLOT_20H]);

    for (let i = 0; i < 3; i++) {
      await request(app)
        .get(`/api/venues/${NIMES.id}/slots`)
        .query({ date: '2026-11-03' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
    await request(app)
      .get(`/api/venues/${NIMES.id}/slots`)
      .query({ date: '2026-11-04' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(sessions).toHaveBeenCalledTimes(2);
  });

  it('should answer an empty list when the venue is closed that day', async () => {
    const { token } = await createAuthenticatedUser();
    sessions.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/venues/${NIMES.id}/slots`)
      .query({ date: '2026-12-25' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should refuse a venue that was not filled from eva.gg, without asking eva.gg', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await request(app)
      .get(`/api/venues/${HAND_MADE.id}/slots`)
      .query({ date: '2026-11-03' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.errors).toEqual([ERROR.venueNotOnEva]);
    expect(sessions).not.toHaveBeenCalled();
  });

  it('should reject an unknown venue', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await request(app)
      .get('/api/venues/nope/slots')
      .query({ date: '2026-11-03' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.errors).toEqual([ERROR.venueNotFound]);
  });

  it('should reject a missing or impossible date without asking eva.gg', async () => {
    const { token } = await createAuthenticatedUser();

    for (const query of [{}, { date: '03/11/2026' }, { date: '2026-02-31' }]) {
      const res = await request(app)
        .get(`/api/venues/${NIMES.id}/slots`)
        .query(query)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([ERROR.dateInvalid]);
    }
    expect(sessions).not.toHaveBeenCalled();
  });

  it('should answer 502 when eva.gg cannot be reached', async () => {
    const { token } = await createAuthenticatedUser();
    sessions.mockRejectedValue(new EvaApiError('eva.gg a répondu 503', [], 503));

    const res = await request(app)
      .get(`/api/venues/${NIMES.id}/slots`)
      .query({ date: '2026-11-03' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(502);
    expect(res.body.errors).toEqual([ERROR.evaUnavailable]);
  });

  it('should reject without authentication', async () => {
    const res = await request(app).get(`/api/venues/${NIMES.id}/slots`).query({ date: '2026-11-03' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/venues', () => {
  it('should say which venues can list their slots', async () => {
    const { token } = await createAuthenticatedUser();

    const res = await request(app)
      .get('/api/venues')
      .set('Authorization', `Bearer ${token}`);

    const byId = new Map(res.body.map((v: { id: string; hasEvaSlots: boolean }) => [v.id, v.hasEvaSlots]));
    expect(byId.get(NIMES.id)).toBe(true);
    expect(byId.get(HAND_MADE.id)).toBe(false);
    expect(res.body.some((v: Record<string, unknown>) => 'externalId' in v)).toBe(false);
  });
});
