// The themes a user can pick. Each id matches a `[data-theme='<id>']` block in
// client/src/styles/themes/; the look itself lives there, this is the menu.

export interface ThemeOption {
  id: string;
  label: string;
  description: string; // One line on what the theme tries, shown in the picker
}

export const THEMES: readonly ThemeOption[] = [
  { id: 'night', label: 'Nuit', description: 'Le thème d\'origine : fond bleu nuit, couleurs franches.' },
  { id: 'slate', label: 'Ardoise', description: 'Teintes naturelles et mates sur un fond grainé, les jours jouables en relief.' },
];

export const DEFAULT_THEME_ID = 'night';

// Where the browser remembers the pick
export const THEME_STORAGE_KEY = 'theme';
