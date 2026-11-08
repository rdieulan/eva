// Tests for the team's Discord channel on the team page: link it, change it, remove it, or see whether it is there
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ERROR } from '@shared/constants';
import type { TeamDiscordStatus } from '@shared/types';
import { ApiError } from '@/api/error';

vi.mock('@/api', () => ({ linkTeamDiscord: vi.fn(), unlinkTeamDiscord: vi.fn() }));

import { linkTeamDiscord, unlinkTeamDiscord } from '@/api';
import TeamDiscord from '@/components/team/TeamDiscord.vue';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abc';

function mountSection(status: TeamDiscordStatus, canManage = true) {
  return mount(TeamDiscord, { props: { status, canManage } });
}

function button(wrapper: ReturnType<typeof mountSection>, text: string) {
  return wrapper.findAll('button').find(candidate => candidate.text() === text);
}

beforeEach(() => {
  vi.mocked(linkTeamDiscord).mockReset().mockResolvedValue();
  vi.mocked(unlinkTeamDiscord).mockReset().mockResolvedValue();
});

describe('TeamDiscord', () => {
  it('links a channel through the webhook pasted, and says where to find it', async () => {
    const wrapper = mountSection('none');

    expect(wrapper.text()).toContain('Dans Discord : paramètres du salon, Intégrations, Webhooks');
    expect(button(wrapper, 'Relier')!.attributes('disabled')).toBeDefined();

    await wrapper.find('#discord-webhook').setValue(`  ${WEBHOOK}  `);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(linkTeamDiscord).toHaveBeenCalledWith(WEBHOOK);
    expect(wrapper.emitted('changed')).toEqual([['linked']]);
  });

  it('says why Discord took nothing, and stays as it was', async () => {
    vi.mocked(linkTeamDiscord).mockRejectedValue(new ApiError([ERROR.discordWebhookRefused], ERROR.discordLinkFailed));
    const wrapper = mountSection('none');

    await wrapper.find('#discord-webhook').setValue(WEBHOOK);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain(ERROR.discordWebhookRefused);
    expect(wrapper.emitted('changed')).toBeFalsy();
  });

  it('changes the channel linked, or removes it', async () => {
    const wrapper = mountSection('linked');

    expect(wrapper.find('.discord-status').text()).toBe('Les notifications de l\'équipe sont postées dans votre salon Discord.');
    expect(wrapper.find('form').exists()).toBe(false);

    await button(wrapper, 'Changer de salon')!.trigger('click');
    expect(wrapper.find('form').exists()).toBe(true);
    await button(wrapper, 'Annuler')!.trigger('click');
    expect(wrapper.find('form').exists()).toBe(false);

    await button(wrapper, 'Retirer')!.trigger('click');
    await flushPromises();
    expect(unlinkTeamDiscord).toHaveBeenCalled();
    expect(wrapper.emitted('changed')).toEqual([['none']]);
  });

  it('says when Discord refused the channel, and asks for a new webhook', () => {
    const wrapper = mountSection('broken');

    expect(wrapper.find('[role="alert"]').text()).toBe(
      'Discord a refusé le dernier message : le webhook a sans doute été supprimé. Collez une nouvelle adresse pour reprendre.',
    );
    expect(wrapper.find('#discord-webhook').exists()).toBe(true);
    expect(button(wrapper, 'Retirer')).toBeDefined();
  });

  it('only tells the other members whether a channel takes the notifications', () => {
    const linked = mountSection('linked', false);
    expect(linked.find('.discord-status').text()).toBe('Les notifications de l\'équipe sont postées dans le salon Discord de l\'équipe.');
    expect(linked.find('button').exists()).toBe(false);
    expect(mountSection('none', false).find('.discord-status').text()).toBe('Aucun salon Discord n\'est relié.');
    const broken = mountSection('broken', false);
    expect(broken.find('[role="alert"]').text()).toBe('Discord a refusé le dernier message : le webhook a sans doute été supprimé.');
    expect(broken.find('form').exists()).toBe(false);
    expect(broken.find('button').exists()).toBe(false);
  });
});
