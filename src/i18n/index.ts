import { createContext, useContext } from 'react';

/**
 * Interface language
 * ------------------
 * Each component keeps its own texts next to it, as a `defineMessages({ en, tr })` table, and
 * picks the current language's half with `useMessages`. The `tr` half must have exactly the keys
 * (and, for texts with values, the same function signatures) of the `en` half, so a missing
 * translation is a type error.
 *
 * Only the editor's interface is translated. The diagram itself (legend rows, exported files)
 * is the user's content and is never changed by the language setting.
 */

export type Language = 'en' | 'tr';
export const LANGUAGES: readonly Language[] = ['en', 'tr'];

/** A text, or a function building one from values (counts, names). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Message = string | ((...args: any[]) => string);
export type Messages = Record<string, Message>;

export const defineMessages = <T extends Messages>(messages: { en: T; tr: { [K in keyof T]: T[K] } }) => messages;

export const LANGUAGE_STORAGE_KEY = 'pinout-maker.language';

/** Saved choice, else the browser's language (Turkish browsers get Turkish), else English. */
export const initialLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'tr') return saved;
  } catch {
    // Storage blocked (private mode): fall back to the browser language
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
};

export interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

// Without a provider (unit tests rendering one component) the interface is English
export const LanguageContext = createContext<LanguageContextValue>({ language: 'en', setLanguage: () => {} });

export const useLanguage = () => useContext(LanguageContext);

/** The current language's half of a `defineMessages` table. */
export const useMessages = <T extends Messages>(messages: { en: T; tr: T }): T => messages[useLanguage().language];
