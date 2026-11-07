// The active theme: remembered by the browser, applied on the document
import { describe, it, expect, beforeEach } from 'vitest';
import { applyStoredTheme, useTheme } from '@/composables/useTheme';
import { DEFAULT_THEME_ID, THEMES, THEME_STORAGE_KEY } from '@/constants/themes';

describe('useTheme', () => {
  beforeEach(() => {
    useTheme().setTheme(DEFAULT_THEME_ID);
    localStorage.clear();
  });

  it('starts on the default theme and puts it on the document', () => {
    applyStoredTheme();
    expect(useTheme().theme.value.id).toBe(DEFAULT_THEME_ID);
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
  });

  it('lists every theme a user can pick', () => {
    expect(useTheme().themes).toBe(THEMES);
    expect(THEMES.map(theme => theme.id)).toContain(DEFAULT_THEME_ID);
  });

  it('applies and remembers a pick, shared by every consumer', () => {
    const picker = useTheme();
    const reader = useTheme();
    picker.setTheme(DEFAULT_THEME_ID);

    expect(reader.theme.value.id).toBe(DEFAULT_THEME_ID);
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
    expect(localStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, DEFAULT_THEME_ID);
  });

  it('ignores a theme it does not know', () => {
    const { theme, setTheme } = useTheme();
    setTheme('does-not-exist');
    expect(theme.value.id).toBe(DEFAULT_THEME_ID);
    expect(localStorage.setItem).not.toHaveBeenCalledWith(THEME_STORAGE_KEY, 'does-not-exist');
  });
});
