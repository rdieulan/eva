// Tests for the links of a team as its page lists them: each told apart by who
// made it, when it runs out and how many joined through it, never by its code
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import type { TeamInvite } from '@/api';
import TeamInvites from '@/components/team/TeamInvites.vue';

const NOW = new Date('2030-06-10T12:00:00Z');

function invite(overrides: Partial<TeamInvite> = {}): TeamInvite {
  return {
    id: 'invite-1',
    code: '065e4e7c4a44c0b2e8290a37fcdc9fd1',
    url: 'https://scrim-calendar.com/join/065e4e7c4a44c0b2e8290a37fcdc9fd1',
    expiresAt: '2030-06-11T11:59:00Z', // 23h 59min ahead
    maxUses: 1,
    uses: 0,
    createdBy: 'Sib',
    createdAt: '2030-06-10T12:00:00Z',
    ...overrides,
  };
}

function mountList(invites: TeamInvite[]) {
  return mount(TeamInvites, { props: { invites }, global: { stubs: { SvgIcon: true } } });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TeamInvites', () => {
  it('tells each link by who made it, when it runs out and how many joined, never by its code', () => {
    const wrapper = mountList([
      invite(),
      invite({ id: 'invite-2', createdBy: 'Nova', expiresAt: '2030-06-17T13:00:00Z', maxUses: 5, uses: 2 }),
    ]);

    const rows = wrapper.findAll('.invite-item');
    expect(rows.map(row => row.find('.invite-creator').text())).toEqual(['Créé par Sib', 'Créé par Nova']);
    expect(rows.map(row => row.find('.invite-details').text())).toEqual([
      'Expire dans 23h 59min • 0/1 utilisation',
      'Expire dans 7j 1h • 2/5 utilisations',
    ]);
    expect(wrapper.text()).not.toContain(invite().code);
  });

  it('counts the last minutes, and says a link past its time has run out', () => {
    const wrapper = mountList([
      invite({ expiresAt: '2030-06-10T12:45:30Z' }),
      invite({ id: 'invite-2', expiresAt: '2030-06-10T11:00:00Z' }),
    ]);

    expect(wrapper.findAll('.invite-details').map(details => details.text())).toEqual([
      'Expire dans 45min • 0/1 utilisation',
      'Expiré • 0/1 utilisation',
    ]);
  });

  it('copies the link itself, and revokes the one picked', async () => {
    const wrapper = mountList([invite(), invite({ id: 'invite-2' })]);

    await wrapper.findAll('[title="Copier le lien"]')[0]!.trigger('click');
    await wrapper.findAll('[title="Révoquer"]')[1]!.trigger('click');

    expect(wrapper.emitted('copy')).toEqual([[invite().url]]);
    expect(wrapper.emitted('revoke')).toEqual([['invite-2']]);
  });

  it('shows nothing while the team has no link open', () => {
    expect(mountList([]).find('.invites-section').exists()).toBe(false);
  });
});
