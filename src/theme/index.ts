import { createContext, useContext } from 'react';

/**
 * Light / dark interface
 * ----------------------
 * 'system' follows the operating system. The chosen theme puts the `dark` class on <html>, which
 * Tailwind's `dark:` variant keys on (see index.css); index.html applies it before React starts,
 * so a dark page never flashes white.
 *
 * Only the interface (toolbar, sidebar, panels, dialogs) gets dark. The canvas stays light in
 * both themes, like the artboard of a design tool: pin colours (black GND labels, dark lines and
 * anchors) keep their contrast, and the canvas looks exactly like the exported file.
 */

export type ThemeSetting = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'pinout-maker.theme';

export const readThemeSetting = (): ThemeSetting => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Storage blocked: follow the system
  }
  return 'system';
};

export const systemPrefersDark = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

export interface ThemeContextValue {
  setting: ThemeSetting;
  setSetting: (setting: ThemeSetting) => void;
  /** What is shown now ('system' resolved). */
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({ setting: 'light', setSetting: () => {}, isDark: false });

export const useTheme = () => useContext(ThemeContext);

/** Toolbar button order: light → dark → system → light. */
export const nextThemeSetting = (setting: ThemeSetting): ThemeSetting =>
  setting === 'light' ? 'dark' : setting === 'dark' ? 'system' : 'light';
