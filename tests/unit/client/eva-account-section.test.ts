// Tests for the eva.gg section of the profile: the account linked can be
// changed for another, never dropped
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

vi.mock('@/api', () => ({
  fetchMyEvaAccount: vi.fn(),
  linkMyEvaAccount: vi.fn(),
}));

import { fetchMyEvaAccount, linkMyEvaAccount } from '@/api';
import EvaAccountSection from '@/components/profile/EvaAccountSection.vue';

const SIB = { userId: 724190, username: 'RONxSib#177352', linkedAt: '2026-11-09T12:00:00.000Z' };

async function mountSection() {
  const wrapper = mount(EvaAccountSection);
  await flushPromises();
  return wrapper;
}

const labels = (wrapper: Awaited<ReturnType<typeof mountSection>>) => wrapper.findAll('button').map(button => button.text());

beforeEach(() => {
  vi.mocked(fetchMyEvaAccount).mockReset().mockResolvedValue(SIB);
  vi.mocked(linkMyEvaAccount).mockReset();
});

describe('EvaAccountSection', () => {
  it('offers to change the account linked, never to drop it', async () => {
    const wrapper = await mountSection();

    expect(wrapper.text()).toContain('RONxSib#177352');
    expect(labels(wrapper)).toEqual(['Changer']);
  });

  it('names the account a change replaces, and calls it off back to it', async () => {
    const wrapper = await mountSection();

    await wrapper.get('button').trigger('click');
    expect(wrapper.get('label').text()).toBe('Nouveau tag eva.gg, à la place de RONxSib#177352');
    expect(labels(wrapper)).toEqual(['Lier ce compte à la place', 'Annuler']);

    await wrapper.findAll('button')[1]!.trigger('click');
    expect(labels(wrapper)).toEqual(['Changer']);
    expect(linkMyEvaAccount).not.toHaveBeenCalled();
  });

  it('shows the new account once linked in place of the old one', async () => {
    const other = { userId: 202617, username: 'Sib#202617', linkedAt: '2026-11-10T12:00:00.000Z' };
    vi.mocked(linkMyEvaAccount).mockResolvedValue(other);
    const wrapper = await mountSection();

    await wrapper.get('button').trigger('click');
    await wrapper.get('input').setValue('Sib#202617');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(linkMyEvaAccount).toHaveBeenCalledWith('Sib#202617');
    expect(wrapper.text()).toContain('Sib#202617');
    expect(wrapper.text()).toContain('Compte eva.gg changé');
    expect(labels(wrapper)).toEqual(['Changer']);
  });
});
