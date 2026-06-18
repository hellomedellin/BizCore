import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import es, { type Translations } from "@/locales/es";
import en from "@/locales/en";

export type Lang = "es" | "en";
const STORAGE_KEY = "bizcore-lang";

function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {}
  return "es";
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "es",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

const STRINGS: Record<Lang, Record<keyof Translations, string>> = { es, en };

export function useT() {
  const { lang } = useLang();
  const strings = STRINGS[lang];

  return function t(key: keyof Translations, vars?: Record<string, string | number>): string {
    let str: string = strings[key] ?? es[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };
}
