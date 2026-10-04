/** Model name the server reports when no AI credit/key is available and the schedule follows employee preferences. */
export const NO_AI_MODEL = "mock-local";

/** טקסטים ישנים של המלצות mock — לא מוצגים למנהל. */
const LEGACY_MOCK_REASON_MARKERS = ["המלצה לדוגמה ללא מפתח OpenAI", "שובץ על ידי AI ואושר על ידי הנהלה"];

/** מה להציג בעמודת ההערות: ללא טקסט טכני/דמה; תוכן ממודל אמת או הסבר "ללא AI" כשיש. */
export function preferenceAiQueueDisplayNotes(reason: string | undefined, _batchModel?: string): string {
  const raw = typeof reason === "string" ? reason.trim() : "";
  if (!raw) return "";
  if (LEGACY_MOCK_REASON_MARKERS.some((m) => raw.includes(m))) return "";
  return raw;
}
