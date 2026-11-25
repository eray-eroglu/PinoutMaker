import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, nextThemeSetting, useTheme } from '.';
import { ThemeProvider } from './ThemeProvider';

/** jsdom has no matchMedia; this one reports the given system preference and can change it. */
const stubMatchMedia = (initiallyDark: boolean) => {
  const listeners = new Set<() => void>();
  const query = {
    matches: initiallyDark,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return (dark: boolean) => {
    query.matches = dark;
    listeners.forEach(listener => listener());
  };
};

const Capture = () => {
  const { setSetting } = useTheme();
  return (
    <>
      <button onClick={() => setSetting('light')}>light</button>
      <button onClick={() => setSetting('dark')}>dark</button>
    </>
  );
};

const setTheme = (setting: 'light' | 'dark') => fireEvent.click(screen.getByText(setting));

const html = document.documentElement;

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  html.classList.remove('dark');
  html.style.colorScheme = '';
});

describe('nextThemeSetting', () => {
  it('cycles light → dark → system → light', () => {
    expect(nextThemeSetting('light')).toBe('dark');
    expect(nextThemeSetting('dark')).toBe('system');
    expect(nextThemeSetting('system')).toBe('light');
  });
});

describe('ThemeProvider', () => {
  it('puts the dark class on <html> for dark and removes it for light', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(
      <ThemeProvider>
        <Capture />
      </ThemeProvider>,
    );
    expect(html).toHaveClass('dark');

    setTheme('light');
    expect(html).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    setTheme('dark');
    expect(html).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('works without matchMedia (system means light)', () => {
    render(
      <ThemeProvider>
        <Capture />
      </ThemeProvider>,
    );
    expect(html).not.toHaveClass('dark');
  });

  it('follows the system preference in system mode', () => {
    const setSystemDark = stubMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    render(
      <ThemeProvider>
        <Capture />
      </ThemeProvider>,
    );
    expect(html).toHaveClass('dark');

    act(() => setSystemDark(false));
    expect(html).not.toHaveClass('dark');

    // An explicit choice overrides the system
    setTheme('dark');
    expect(html).toHaveClass('dark');
  });
});
