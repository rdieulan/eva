// Tests for the team's information: how far ahead its players are asked for
// their availability, shown to all and set by whoever manages the team
import { describe, it, expect } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { AVAILABILITY_HORIZON_MAX_DAYS, ERROR } from '@shared/constants';
import TeamInfo from '@/components/team/TeamInfo.vue';

const TEAM = {
  id: 'team-1',
  name: 'RONIN',
  logoUrl: null,
  favoriteVenueIds: [],
  availabilityHorizonDays: 15,
  leader: { id: 'player-1', name: 'Sib' },
};

function mountInfo() {
  return mount(TeamInfo, {
    props: { team: TEAM, venues: [], canManageTeam: true, isLeader: true },
    global: { stubs: { RouterLink: RouterLinkStub, TeamLogo: true, VenueChecklist: true } },
  });
}

async function editing() {
  const wrapper = mountInfo();
  await wrapper.get('.btn-edit').trigger('click');
  return wrapper;
}

describe('TeamInfo, the availability horizon', () => {
  it('shows how far ahead the players are asked', () => {
    const shown = mountInfo().findAll('.info-item').find(item => item.text().startsWith('Dispos demandées sur'))!;

    expect(shown.get('span').text()).toBe('15 jours');
  });

  it('saves the horizon set with the rest of the information', async () => {
    const wrapper = await editing();
    const field = wrapper.get<HTMLInputElement>('#team-horizon');
    expect(field.element.value).toBe('15');

    await field.setValue('21');
    await wrapper.get('.btn-save').trigger('click');

    expect(wrapper.emitted('save')).toEqual([[{ name: 'RONIN', venueId: null, favoriteVenueIds: [], availabilityHorizonDays: 21 }]]);
  });

  it('keeps a horizon out of its bounds, or not a whole number of days, from being saved', async () => {
    const wrapper = await editing();
    const field = wrapper.get('#team-horizon');

    for (const value of [String(AVAILABILITY_HORIZON_MAX_DAYS + 1), '10.5', '']) {
      await field.setValue(value);
      expect(wrapper.get('.btn-save').attributes('disabled')).toBeDefined();
      expect(wrapper.get('#team-horizon-hint').text()).toBe(ERROR.availabilityHorizonInvalid);
    }
    await wrapper.get('.btn-save').trigger('click');
    expect(wrapper.emitted('save')).toBeUndefined();
  });
});
