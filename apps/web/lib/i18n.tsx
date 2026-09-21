'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, type Lang, type T } from './translations';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lang') as Lang | null;
      if (stored === 'en' || stored === 'de') {
        setLangState(stored);
      } else {
        const detected: Lang = navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
        setLangState(detected);
      }
    } catch {
      // localStorage unavailable — stay with default 'en'
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
      localStorage.setItem('lang', lang);
    } catch {
      // localStorage unavailable
    }
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
