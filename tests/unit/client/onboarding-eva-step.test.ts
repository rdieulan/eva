// Tests for the eva.gg step of the first-login walk-through: it cannot be
// skipped, and it is done once an account is linked
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ERROR } from '@shared/constants';
import { ApiError } from '@/api/error';

vi.mock('@/api', () => ({
  fetchMyEvaAccount: vi.fn(),
  linkMyEvaAccount: vi.fn(),
}));

import { fetchMyEvaAccount, linkMyEvaAccount } from '@/api';
import OnboardingEvaStep from '@/components/onboarding/OnboardingEvaStep.vue';

const SIB = { userId: 724190, username: 'RONxSib#177352', linkedAt: '2026-11-10T12:00:00.000Z' };

async function mountStep() {
  const wrapper = mount(OnboardingEvaStep);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.mocked(fetchMyEvaAccount).mockReset().mockResolvedValue(null);
  vi.mocked(linkMyEvaAccount).mockReset();
});

describe('OnboardingEvaStep', () => {
  it('offers no way past it without an account: only the link, once a tag is typed', async () => {
    const wrapper = await mountStep();

    const buttons = wrapper.findAll('button');
    expect(buttons.map(button => button.text())).toEqual(['Lier mon compte']);
    expect(buttons[0]!.attributes('disabled')).toBeDefined();
    await wrapper.get('input').setValue('RONxSib#177352');
    expect(buttons[0]!.attributes('disabled')).toBeUndefined();
  });

  it('is done once the account is linked, not when eva.gg refuses it', async () => {
    vi.mocked(linkMyEvaAccount).mockRejectedValueOnce(new ApiError([ERROR.evaAccountAlreadyLinked], ERROR.evaAccountLinkFailed));
    const wrapper = await mountStep();
    await wrapper.get('input').setValue('RONxSib#177352');

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.emitted('done')).toBeUndefined();
    expect(wrapper.text()).toContain(ERROR.evaAccountAlreadyLinked);

    vi.mocked(linkMyEvaAccount).mockResolvedValueOnce(SIB);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.emitted('done')).toHaveLength(1);
  });

  it('goes on at once for a player whose account is already linked', async () => {
    vi.mocked(fetchMyEvaAccount).mockResolvedValue(SIB);
    const wrapper = await mountStep();

    expect(wrapper.text()).toContain('Lié à RONxSib#177352');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('done')).toHaveLength(1);
    expect(linkMyEvaAccount).not.toHaveBeenCalled();
  });
});
