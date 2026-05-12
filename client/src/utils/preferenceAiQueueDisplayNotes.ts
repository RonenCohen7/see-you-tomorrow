/** טקסט ההסבר מה-AI בהמלצות mock — לא מוצג בתור העדפות למנהל. */
const MOCK_REASON_MARKER = "המלצה לדוגמה ללא מפתח OpenAI";

/** מה להציג בעמודת ההערות: ללא טקסט טכני/דמה; תוכן ממודל אמת כשיש. */
export function preferenceAiQueueDisplayNotes(reason: string | undefined, batchModel: string | undefined): string {
  const raw = typeof reason === "string" ? reason.trim() : "";
  if (!raw) return "";
  if (batchModel === "mock-local") return "";
  if (raw.includes(MOCK_REASON_MARKER)) return "";
  return raw;
}
