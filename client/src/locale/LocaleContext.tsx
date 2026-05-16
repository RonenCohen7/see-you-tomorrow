import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import i18n from "../i18n";
import {
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  syncDocumentLocale,
  type AppLocale,
} from "./localeConstants";

type Ctx = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const LocaleCtx = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale());

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    syncDocumentLocale(next);
    void i18n.changeLanguage(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Ctx {
  const x = useContext(LocaleCtx);
  if (!x) throw new Error("LocaleProvider missing");
  return x;
}
