import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_STORAGE_KEY, defineMessages, initialLanguage, useLanguage, useMessages } from '.';
import { LanguageProvider } from './LanguageProvider';

const MESSAGES = defineMessages({
  en: { hello: 'Hello', pins: (n: number) => `${n} pins` },
  tr: { hello: 'Merhaba', pins: (n: number) => `${n} pin` },
});

const Greeting = () => {
  const t = useMessages(MESSAGES);
  const { language, setLanguage } = useLanguage();
  return (
    <div>
      <p>{t.hello}</p>
      <p>{t.pins(3)}</p>
      <button onClick={() => setLanguage(language === 'en' ? 'tr' : 'en')}>switch</button>
    </div>
  );
};

const mockBrowserLanguage = (language: string) => vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.lang = '';
});

describe('initialLanguage', () => {
  it('prefers the saved choice over the browser language', () => {
    mockBrowserLanguage('tr-TR');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    expect(initialLanguage()).toBe('en');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'tr');
    mockBrowserLanguage('en-US');
    expect(initialLanguage()).toBe('tr');
  });

  it('gives a Turkish browser Turkish', () => {
    mockBrowserLanguage('tr-TR');
    expect(initialLanguage()).toBe('tr');
  });

  it('falls back to English for other browsers and unknown saved values', () => {
    mockBrowserLanguage('de-DE');
    expect(initialLanguage()).toBe('en');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    expect(initialLanguage()).toBe('en');
  });
});

describe('LanguageProvider', () => {
  it('sets <html lang> and remembers the choice', () => {
    render(
      <LanguageProvider initial='tr'>
        <Greeting />
      </LanguageProvider>,
    );
    expect(document.documentElement.lang).toBe('tr');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('tr');

    fireEvent.click(screen.getByText('switch'));
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});

describe('useMessages', () => {
  it('is English without a provider', () => {
    render(<Greeting />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('3 pins')).toBeInTheDocument();
  });

  it('switches tables with the language', () => {
    render(
      <LanguageProvider initial='tr'>
        <Greeting />
      </LanguageProvider>,
    );
    expect(screen.getByText('Merhaba')).toBeInTheDocument();
    expect(screen.getByText('3 pin')).toBeInTheDocument();

    fireEvent.click(screen.getByText('switch'));
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('3 pins')).toBeInTheDocument();
  });
});
