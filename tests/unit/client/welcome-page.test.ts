// Tests for the first-login walk-through: one question a page, in order, the
// team step only when the player did not come to join one, and an end that
// marks it done and goes on where the player was going
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';

const route = vi.hoisted(() => ({ query: {} as Record<string, string> }));
const replace = vi.hoisted(() => vi.fn());
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }));

const auth = vi.hoisted(() => ({ account: null as unknown, setAuth: vi.fn() }));
vi.mock('@/composables/useAuth', () => ({ useAuth: () => auth }));

vi.mock('@/api/auth.api', () => ({ finishOnboarding: vi.fn() }));

// Each step stands in as a button that answers it: the walk-through is what is tested here
function stepStub(name: string, event: 'done' | 'finish' = 'done', destination?: string) {
  return defineComponent({
    name,
    emits: ['done', 'finish'],
    setup(_, { emit }) {
      return () => h('button', { class: `stub-${name}`, onClick: () => (event === 'done' ? emit('done') : emit('finish', destination)) }, name);
    },
  });
}

vi.mock('@/components/onboarding/OnboardingNameStep.vue', () => ({ default: stepStub('name') }));
vi.mock('@/components/onboarding/OnboardingEvaStep.vue', () => ({ default: stepStub('eva') }));
vi.mock('@/components/onboarding/OnboardingPassStep.vue', () => ({ default: stepStub('pass') }));
vi.mock('@/components/onboarding/OnboardingTeamStep.vue', () => ({ default: stepStub('team', 'finish', '/team/create') }));

import { finishOnboarding } from '@/api/auth.api';
import WelcomePage from '@/pages/WelcomePage.vue';

const DONE = { id: 'user-1', name: 'Raph', isOnboarded: true };

function mountPage() {
  return mount(WelcomePage);
}

async function answer(wrapper: ReturnType<typeof mountPage>, step: string) {
  await wrapper.get(`.stub-${step}`).trigger('click');
  await flushPromises();
}

beforeEach(() => {
  route.query = {};
  auth.account = ref({ id: 'user-1', name: 'Raph', teamId: null, isOnboarded: false });
  auth.setAuth.mockReset();
  replace.mockReset();
  vi.mocked(finishOnboarding).mockReset().mockResolvedValue(DONE as never);
});

describe('WelcomePage', () => {
  it('asks one question a page, pseudo, eva.gg, EVA Pass, then team, and ends where the team step leads', async () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('Bienvenue, Raph !');

    for (const [step, count] of [['name', 1], ['eva', 2], ['pass', 3]] as const) {
      expect(wrapper.text()).toContain(`Étape ${count} sur 4`);
      await answer(wrapper, step);
    }
    expect(wrapper.find('.stub-team').exists()).toBe(true);
    // The last step has its own way out
    expect(wrapper.find('.later').exists()).toBe(false);
    expect(finishOnboarding).not.toHaveBeenCalled();

    await answer(wrapper, 'team');

    expect(finishOnboarding).toHaveBeenCalledTimes(1);
    expect(auth.setAuth).toHaveBeenCalledWith(DONE);
    expect(replace).toHaveBeenCalledWith('/team/create');
  });

  it('leaves the team step out for a player who came to join a team, and ends on that page', async () => {
    route.query = { next: '/join/ABC123' };
    const wrapper = mountPage();

    await answer(wrapper, 'name');
    await answer(wrapper, 'eva');
    expect(wrapper.text()).toContain('Étape 3 sur 3');
    await answer(wrapper, 'pass');

    expect(replace).toHaveBeenCalledWith('/join/ABC123');
  });

  it('leaves the team step out for a player who already has a team', () => {
    auth.account = ref({ id: 'user-1', name: 'Raph', teamId: 'team-1', isOnboarded: false });

    expect(mountPage().text()).toContain('Étape 1 sur 3');
  });

  it('goes back a step, and skips everything at once with "Plus tard"', async () => {
    route.query = { next: '/salles/nimes' };
    const wrapper = mountPage();
    await answer(wrapper, 'name');

    await wrapper.get('.back').trigger('click');
    expect(wrapper.find('.stub-name').exists()).toBe(true);

    await wrapper.get('.later').trigger('click');
    await flushPromises();
    expect(finishOnboarding).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/salles/nimes');
  });

  it('never ends on another site', async () => {
    route.query = { next: '//evil.example' };
    const wrapper = mountPage();

    await wrapper.get('.later').trigger('click');
    await flushPromises();

    expect(replace).toHaveBeenCalledWith('/');
  });

  it('stays when the end cannot be saved, and says so', async () => {
    vi.mocked(finishOnboarding).mockRejectedValueOnce(new Error('down'));
    const wrapper = mountPage();

    await wrapper.get('.later').trigger('click');
    await flushPromises();

    expect(replace).not.toHaveBeenCalled();
    expect(wrapper.find('.error-display').exists()).toBe(true);
  });
});
