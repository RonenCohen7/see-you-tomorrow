import type { AppLocale } from "../locale/localeConstants";

function replaceUrlsForSpeech(s: string, locale: AppLocale): string {
  return s.replace(/https?:\/\/[^\s)]+/gi, (url) => {
    const lower = url.toLowerCase();
    if (lower.includes("localhost:8025")) {
      return locale === "he"
        ? "פתחו את ממשק דואר הפיתוח במחשב המקומי, על פורט שמונים עשרים וחמש."
        : "Open the development mail UI on port eighty twenty-five.";
    }
    return "";
  });
}

/**
 * Speech-oriented cleanup — merges punctuation noise for clearer narration.
 * Screen captions stay unchanged upstream.
 */
export function normalizeTextForTts(raw: string, locale: AppLocale): string {
  let s = raw
    .replace(/\u00AB/g, " ")
    .replace(/\u00BB/g, " ")
    .replace(/\u201C/g, " ")
    .replace(/\u201D/g, " ")
    .replace(/\u2013|\u2014/g, ", ")
    .replace(/\u2026/g, " ")
    .replace(/…/g, " ");
  s = replaceUrlsForSpeech(s, locale);
  s = s.replace(/\.{2,}/g, " ");
  s = s.replace(/\s*,\s*,/g, ",");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\s+([.,;:])/g, "$1");
  if (locale === "he") {
    s = s.replace(/([.!?])\s*([א-ת])/g, "$1 $2");
  }
  return s.trim();
}

export function voiceScoreHebrew(v: SpeechSynthesisVoice): number {
  let s = 0;
  const n = v.name.toLowerCase();
  const lang = (v.lang ?? "").toLowerCase();
  if (lang === "he-il" || lang === "he") s += 8;
  else if (lang.startsWith("he")) s += 5;
  if (/hebrew|עברית/.test(v.name)) s += 4;
  if (/carmit|daniel/.test(n) && lang.startsWith("he")) s += 3;
  if (n.includes("premium") || n.includes("enhanced") || n.includes("natural")) s += 3;
  if (n.includes("google")) s += 2;
  if (v.localService && lang.startsWith("he")) s += 2;
  if (v.default && lang.startsWith("he")) s += 1;
  return s;
}

export function voiceScoreEnglish(v: SpeechSynthesisVoice): number {
  let s = 0;
  const n = v.name.toLowerCase();
  const lang = (v.lang ?? "").toLowerCase();
  if (lang === "en-us" || lang === "en-gb" || lang === "en") s += 8;
  else if (lang.startsWith("en")) s += 5;
  if (/english/.test(v.name)) s += 4;
  if (n.includes("premium") || n.includes("enhanced") || n.includes("natural")) s += 3;
  if (n.includes("google")) s += 2;
  if (v.localService && lang.startsWith("en")) s += 2;
  if (v.default && lang.startsWith("en")) s += 1;
  return s;
}

export function pickHebrewVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const he = voices.filter((v) => {
    const lang = (v.lang ?? "").toLowerCase();
    return lang.startsWith("he") || /hebrew|עברית/i.test(v.name);
  });
  if (he.length === 0) return null;
  return [...he].sort((a, b) => voiceScoreHebrew(b) - voiceScoreHebrew(a))[0] ?? null;
}

export function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => {
    const lang = (v.lang ?? "").toLowerCase();
    return lang.startsWith("en") || /english/i.test(v.name);
  });
  if (en.length === 0) return null;
  return [...en].sort((a, b) => voiceScoreEnglish(b) - voiceScoreEnglish(a))[0] ?? null;
}

export function pickVoiceForLocale(locale: AppLocale): SpeechSynthesisVoice | null {
  return locale === "en" ? pickEnglishVoice() : pickHebrewVoice();
}

/** Align utterance language with chosen voice */
export function utteranceLangForVoice(voice: SpeechSynthesisVoice | null, locale: AppLocale): string {
  if (!voice) return locale === "en" ? "en-US" : "he-IL";
  const lang = voice.lang.trim();
  if (/^en\b/i.test(lang)) return lang.length >= 4 ? lang : "en-US";
  if (/^he\b/i.test(lang)) return lang.length >= 4 ? lang : "he-IL";
  return locale === "en" ? "en-US" : "he-IL";
}
