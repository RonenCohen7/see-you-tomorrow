import { EN } from "./en";

export type AppLocale = "he" | "en";

let currentLocale: AppLocale = "he";

export function getLocale(): AppLocale {
  return currentLocale;
}

export function setCurrentLocale(locale: AppLocale): void {
  currentLocale = locale;
}

export function t(text: string): string {
  if (!text || currentLocale === "he") return text;
  return EN[text] ?? text;
}

export function tr(he: string, en: string): string {
  return currentLocale === "en" ? en : he;
}

export function hello(name: string): string {
  return currentLocale === "en" ? `Hello, ${name}` : `שלום, ${name}`;
}

export function intlTag(): string {
  return currentLocale === "en" ? "en-US" : "he-IL";
}
