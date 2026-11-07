// The theme picker of the profile page
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ThemeSection from '@/components/profile/ThemeSection.vue';
import { useTheme } from '@/composables/useTheme';
import { DEFAULT_THEME_ID, THEMES } from '@/constants/themes';

describe('ThemeSection', () => {
  beforeEach(() => {
    useTheme().setTheme(DEFAULT_THEME_ID);
  });

  it('offers every theme, the active one checked', () => {
    const wrapper = mount(ThemeSection);
    const options = wrapper.findAll('[role="radio"]');
    expect(options.map(option => option.find('.theme-name').text())).toEqual(THEMES.map(theme => theme.label));
    const active = options.find(option => option.attributes('aria-checked') === 'true')!;
    expect(active.find('.theme-name').text()).toBe(THEMES.find(theme => theme.id === DEFAULT_THEME_ID)!.label);
  });

  it('applies a theme on click', async () => {
    const wrapper = mount(ThemeSection);
    const last = THEMES[THEMES.length - 1]!;
    await wrapper.findAll('[role="radio"]')[THEMES.length - 1]!.trigger('click');
    expect(useTheme().theme.value.id).toBe(last.id);
    expect(document.documentElement.dataset.theme).toBe(last.id);
  });
});
