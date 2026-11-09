// Integration tests - An invitation to a role, as its link shows it before
// anyone accepts it (accepting it is the Discord login's test)

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/src/app';
import { prisma } from './helpers/db';
import { authHeader, createAuthenticatedAdmin, createAuthenticatedUser } from './helpers/auth';
import { ERROR } from '@shared/constants/error.constants';
import { acceptInvitation } from '../../server/src/services/invitation.service';

async function venue(name: string, slug: string) {
  return prisma.venue.create({ data: { slug, name, city: name, address: '1 rue du Test' } });
}

describe('GET /api/auth/invitations/:token', () => {
  it('shows what a manager invitation gives, to anyone holding its link', async () => {
    const { token } = await createAuthenticatedAdmin();
    const nimes = await venue('Nîmes', 'nimes');
    const avignon = await venue('Avignon', 'avignon');
    const created = await request(app)
      .post('/api/admin/managers')
      .set(authHeader(token))
      .send({ name: 'Jean', venueIds: [nimes.id, avignon.id] });

    const res = await request(app).get(`/api/auth/invitations/${created.body.activationToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ role: 'manager', invitedName: 'Jean', venueNames: ['Avignon', 'Nîmes'], isExpired: false });
  });

  it('shows an admin invitation, and one out of date as such', async () => {
    const { token } = await createAuthenticatedAdmin();
    const created = await request(app)
      .post('/api/admin/admins')
      .set(authHeader(token))
      .send({ name: 'Raph', permissions: { system: { canManageVenues: true, canManageManagers: true, canManageAdmins: true, canViewAllData: true } } });
    await prisma.admin.update({ where: { id: created.body.admin.id }, data: { activationTokenExpiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).get(`/api/auth/invitations/${created.body.activationToken}`);

    expect(res.body).toEqual({ role: 'admin', invitedName: 'Raph', venueNames: [], isExpired: true });
  });

  it('leads nowhere once accepted, or for a link nobody made', async () => {
    const { token } = await createAuthenticatedAdmin();
    const created = await request(app)
      .post('/api/admin/managers')
      .set(authHeader(token))
      .send({ name: 'Jean', venueIds: [] });
    const { user } = await createAuthenticatedUser();
    expect(await acceptInvitation(created.body.activationToken, user.id)).toBe('MANAGER');

    for (const link of [created.body.activationToken, 'nobody-made-this']) {
      const res = await request(app).get(`/api/auth/invitations/${link}`);
      expect(res.status).toBe(404);
      expect(res.body.errors).toContain(ERROR.invitationInvalid);
    }
  });

  it('gives one manager role to a person accepting two invitations at once, the other staying to be used', async () => {
    const { token } = await createAuthenticatedAdmin();
    const invite = () => request(app).post('/api/admin/managers').set(authHeader(token)).send({ name: 'Jean', venueIds: [] });
    const [first, second] = [(await invite()).body, (await invite()).body];
    const { user } = await createAuthenticatedUser();

    const outcomes = await Promise.all([
      acceptInvitation(first.activationToken, user.id),
      acceptInvitation(second.activationToken, user.id),
    ]);

    expect(outcomes.sort()).toEqual(['MANAGER', 'roleTaken']);
    const holder = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const left = holder.managerId === first.manager.id ? second : first;
    // The invitation not taken still works for someone else
    expect((await request(app).get(`/api/auth/invitations/${left.activationToken}`)).status).toBe(200);
  });

  it('lets one person take a link that two open at once', async () => {
    const { token } = await createAuthenticatedAdmin();
    const created = await request(app)
      .post('/api/admin/managers')
      .set(authHeader(token))
      .send({ name: 'Jean', venueIds: [] });
    const [first, second] = await Promise.all([createAuthenticatedUser(), createAuthenticatedUser()]);

    const outcomes = await Promise.all([
      acceptInvitation(created.body.activationToken, first.user.id),
      acceptInvitation(created.body.activationToken, second.user.id),
    ]);

    expect(outcomes.sort()).toEqual(['MANAGER', 'invalid']);
    expect(await prisma.user.count({ where: { managerId: created.body.manager.id } })).toBe(1);
  });
});
