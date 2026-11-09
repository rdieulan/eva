// Tests for the team step of the first-login walk-through: each way in ends
// the walk-through on its page
import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import type { LeagueTeamSummary, MyJoinRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import OnboardingTeamStep from '@/components/onboarding/OnboardingTeamStep.vue';

const RONIN: LeagueTeamSummary = { id: '2444500737328074751', name: 'RONIN', memberCount: 5, logoUrl: null, team: null };
const WAITING: MyJoinRequest = { id: 'request-1', status: 'PENDING', team: { id: 'team-zero', name: 'zero', logoUrl: null }, createdAt: '2026-11-09T20:00:00Z' };

const FinderStub = defineComponent({
  name: 'LeagueTeamFinder',
  emits: ['create', 'requested'],
  setup(_, { emit }) {
    return () => h('div', [
      h('button', { class: 'make', onClick: () => emit('create', RONIN) }, 'make'),
      h('button', { class: 'ask', onClick: () => emit('requested', WAITING) }, 'ask'),
    ]);
  },
});

function mountStep() {
  return mount(OnboardingTeamStep, { props: { isFinishing: false }, global: { stubs: { LeagueTeamFinder: FinderStub } } });
}

function button(wrapper: ReturnType<typeof mountStep>, label: string) {
  const found = wrapper.findAll('button').find(candidate => candidate.text() === label);
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

describe('OnboardingTeamStep', () => {
  it('ends on the creation page of the league team picked', async () => {
    const wrapper = mountStep();

    await wrapper.get('.make').trigger('click');

    expect(wrapper.emitted('finish')).toEqual([[`/team/create?ligue=${RONIN.id}`]]);
  });

  it('ends on the home screen once a request is sent, where its answer shows', async () => {
    const wrapper = mountStep();

    await wrapper.get('.ask').trigger('click');

    expect(wrapper.emitted('finish')).toEqual([['/']]);
  });

  it('joins with a link once asked for it', async () => {
    const wrapper = mountStep();
    expect(wrapper.find('input').exists()).toBe(false);

    await button(wrapper, 'Tu as un lien d\'invitation ?').trigger('click');
    await wrapper.get('input').setValue('https://eva.example/join/ABC123');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('finish')).toEqual([['/join/ABC123']]);
  });

  it('says a link left blank is no link', async () => {
    const wrapper = mountStep();
    await button(wrapper, 'Tu as un lien d\'invitation ?').trigger('click');

    await wrapper.get('input').setValue('   ');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.text()).toContain(ERROR.inviteCodeInvalid);
    expect(wrapper.emitted('finish')).toBeUndefined();
  });

  it('makes a team out of the leagues, or leaves it for later', async () => {
    const wrapper = mountStep();

    await button(wrapper, 'Créer une équipe hors ligue').trigger('click');
    await button(wrapper, 'Plus tard').trigger('click');

    expect(wrapper.emitted('finish')).toEqual([['/team/create'], ['/']]);
  });
});
