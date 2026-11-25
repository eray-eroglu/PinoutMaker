import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LANGUAGE_STORAGE_KEY, LanguageContext, initialLanguage } from '.';
import type { Language } from '.';

/** Holds the interface language; remembers it and keeps <html lang> in step. */
export const LanguageProvider = ({ children, initial }: { children: ReactNode; initial?: Language }) => {
  const [language, setLanguage] = useState<Language>(() => initial ?? initialLanguage());

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Not remembered; the editor still works
    }
  }, [language]);

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
};
