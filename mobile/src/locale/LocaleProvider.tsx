import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { setCurrentLocale, type AppLocale } from "./i18n";

const STORE_KEY = "syt.locale";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("he");

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((stored) => {
        if (stored === "en" || stored === "he") setLocaleState(stored);
      })
      .catch(() => undefined);
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    SecureStore.setItemAsync(STORE_KEY, next).catch(() => undefined);
  }, []);

  setCurrentLocale(locale);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <View style={{ flex: 1, direction: locale === "he" ? "rtl" : "ltr" }}>{children}</View>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}
