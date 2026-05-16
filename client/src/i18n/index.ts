import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { readStoredLocale, syncDocumentLocale } from "../locale/localeConstants";
import { enTranslation } from "./enTranslation";
import { heTranslation } from "./heTranslation";

const initialLng = readStoredLocale();
syncDocumentLocale(initialLng);

const resources = {
  he: { translation: heTranslation },
  en: { translation: enTranslation },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: "he",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
