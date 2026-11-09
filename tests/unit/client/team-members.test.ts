// Tests for the members of a team as its page lists them: who may hand the team
// over (its leader only), and to whom (another member)
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { TeamMember } from '@/api';
import TeamMembers from '@/components/team/TeamMembers.vue';

const LEADER: TeamMember = { id: 'user-lead', name: 'Sib', permissions: null, isLeader: true };
const MEMBER: TeamMember = { id: 'user-nova', name: 'Nova', permissions: null, isLeader: false };

function mountList(props: { isLeader: boolean; canManagePermissions: boolean; currentUserId: string }) {
  return mount(TeamMembers, {
    props: { members: [LEADER, MEMBER], canRemoveMembers: false, canInviteMembers: false, ...props },
    global: { stubs: { SvgIcon: true } },
  });
}

describe('TeamMembers', () => {
  it('offers the leader to hand the team over to another member, never to themself', async () => {
    const wrapper = mountList({ isLeader: true, canManagePermissions: true, currentUserId: LEADER.id });

    const buttons = wrapper.findAll('[title="Transférer la direction"]');
    expect(buttons).toHaveLength(1);
    await buttons[0]!.trigger('click');

    expect(wrapper.emitted('transferLeadership')).toEqual([[MEMBER]]);
  });

  it('offers it to nobody else, whatever they may manage', () => {
    const wrapper = mountList({ isLeader: false, canManagePermissions: true, currentUserId: 'user-other' });

    expect(wrapper.find('[title="Transférer la direction"]').exists()).toBe(false);
    expect(wrapper.find('[title="Gérer les permissions"]').exists()).toBe(true);
  });
});
