import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { THEME_STORAGE_KEY, ThemeContext, readThemeSetting, systemPrefersDark } from '.';
import type { ThemeSetting } from '.';

/** Holds the theme setting; puts the `dark` class on <html> and remembers the choice. */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [setting, setSetting] = useState<ThemeSetting>(readThemeSetting);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const isDark = setting === 'dark' || (setting === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, setting);
    } catch {
      // Not remembered; the editor still works
    }
  }, [setting]);

  return <ThemeContext.Provider value={{ setting, setSetting, isDark }}>{children}</ThemeContext.Provider>;
};
