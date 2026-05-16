/** הערות mock / legacy מתהליך AI ללא OpenAI או מתבניות ישנות — תצוגה קצרה בטבלת לוחות זמנים */
const LEGACY_MOCK_NOTE_MARKERS_HE = ["המלצה לדוגמה ללא מפתח OpenAI", "הגדר OPENAI_API_KEY"];
const MOCK_APPROVED_NOTE_HE = "שובץ על ידי AI ואושר על ידי הנהלה";

export function scheduleNoteShortDisplay(note: string | undefined | null, aiMockLabel: () => string): string {
  const raw = typeof note === "string" ? note.trim() : "";
  if (!raw) return "";
  if (raw === MOCK_APPROVED_NOTE_HE || LEGACY_MOCK_NOTE_MARKERS_HE.some((m) => raw.includes(m))) {
    return aiMockLabel();
  }
  return raw;
}
