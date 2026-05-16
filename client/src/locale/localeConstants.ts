export type AppLocale = "he" | "en";

export const LOCALE_STORAGE_KEY = "syt_locale";

export function readStoredLocale(): AppLocale {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === "en" || v === "he") return v;
  } catch {
    /* ignore */
  }
  return "he";
}

export function localeDirection(locale: AppLocale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

/** BCP 47 locale tag for Intl formatting */
export function appIntlLocale(locale: AppLocale): string {
  return locale === "he" ? "he-IL" : "en-US";
}

export function syncDocumentLocale(locale: AppLocale): void {
  const root = document.documentElement;
  root.lang = locale === "he" ? "he" : "en";
  root.dir = localeDirection(locale);
}
