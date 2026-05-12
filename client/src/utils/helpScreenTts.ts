/** עיבוד טקסט עזרה להקראה ברורה יותר בעברית ב-Web Speech API */

function replaceUrlsForSpeech(s: string): string {
  return s.replace(/https?:\/\/[^\s)]+/gi, (url) => {
    const lower = url.toLowerCase();
    if (lower.includes("localhost:8025")) {
      return "פתחו את ממשק דואר הפיתוח במחשב המקומי, על פורט שמונים עשרים וחמש.";
    }
    return "";
  });
}

/**
 * טקסט להקראה בלבד — מאחד מקפים ארוכים, מסיר תווי ציטוט שמבלבלים קריינים,
 * ומנקה רווחים. הכיתובית על המסך נשארת במקור.
 */
export function normalizeTextForTts(raw: string): string {
  let s = raw
    .replace(/\u00AB/g, " ")
    .replace(/\u00BB/g, " ")
    .replace(/\u201C/g, " ")
    .replace(/\u201D/g, " ")
    .replace(/\u2013|\u2014/g, ", ")
    .replace(/\u2026/g, " ")
    .replace(/…/g, " ");
  s = replaceUrlsForSpeech(s);
  s = s.replace(/\.{2,}/g, " ");
  s = s.replace(/\s*,\s*,/g, ",");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\s+([.,;:])/g, "$1");
  s = s.replace(/([.!?])\s*([א-ת])/g, "$1 $2");
  return s.trim();
}

export function voiceScore(v: SpeechSynthesisVoice): number {
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

export function pickHebrewVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const he = voices.filter((v) => {
    const lang = (v.lang ?? "").toLowerCase();
    return lang.startsWith("he") || /hebrew|עברית/i.test(v.name);
  });
  if (he.length === 0) return null;
  return [...he].sort((a, b) => voiceScore(b) - voiceScore(a))[0] ?? null;
}

/** התאמת שפת ההודעה לקול הנבחר — עוזרת לסינתזה בהגייה מתאימה בחלק מהדפדפנים */
export function utteranceLangForVoice(voice: SpeechSynthesisVoice | null): string {
  if (!voice) return "he-IL";
  const lang = voice.lang.trim();
  if (/^he\b/i.test(lang)) return lang.length >= 4 ? lang : "he-IL";
  return "he-IL";
}
