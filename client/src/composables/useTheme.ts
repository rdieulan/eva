// The active theme: picked by the user, remembered by the browser, applied as
// a `data-theme` attribute on the document so the token files take over.

import { computed, ref } from 'vue';
import { DEFAULT_THEME_ID, THEMES, THEME_STORAGE_KEY, type ThemeOption } from '@/constants/themes';

const themeId = ref(readStoredThemeId());

function isKnownTheme(id: string | null): id is string {
  return id !== null && THEMES.some(theme => theme.id === id);
}

function readStoredThemeId(): string {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isKnownTheme(stored) ? stored : DEFAULT_THEME_ID;
}

function applyToDocument(id: string): void {
  document.documentElement.dataset.theme = id;
}

/**
 * Put the remembered theme on the document. Called once before the app
 * mounts, so the first paint already has the right look.
 */
export function applyStoredTheme(): void {
  applyToDocument(themeId.value);
}

export function useTheme() {
  const theme = computed<ThemeOption>(
    () => THEMES.find(option => option.id === themeId.value) ?? THEMES[0]!,
  );

  function setTheme(id: string): void {
    if (!isKnownTheme(id)) return;
    themeId.value = id;
    localStorage.setItem(THEME_STORAGE_KEY, id);
    applyToDocument(id);
  }

  return { theme, themes: THEMES, setTheme };
}
