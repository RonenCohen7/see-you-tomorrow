/**
 * Lightweight intent detection so admin NL requests work without OPENAI_API_KEY.
 * Matches phrases about removing inactive employees' future shifts from the calendar.
 */
export type ClearInactiveSchedulesMaintenanceIntent =
  | { matched: false }
  | { matched: true; explanationHebrew: string };

/** Normalize: lowercase, unicode letters/digits preserved, punctuation → spaces */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function interpretClearInactiveFutureSchedulesMaintenance(
  naturalText: string
): ClearInactiveSchedulesMaintenanceIntent {
  const n = normalize(naturalText);
  if (n.length < 8) return { matched: false };

  const mentionsInactive =
    n.includes(normalize("לא פעיל")) ||
    n.includes("inactive") ||
    n.includes(normalize("בסטטוס לא פעיל"));

  const mentionsRemoval =
    n.includes(normalize("הסר")) ||
    n.includes(normalize("מחק")) ||
    n.includes(normalize("ניקוי")) ||
    n.includes("remove") ||
    n.includes("delete") ||
    n.includes("clear") ||
    n.includes("purge");

  const mentionsCalendarOrShifts =
    n.includes(normalize("יומן")) ||
    n.includes(normalize("לוח זמנים")) ||
    n.includes(normalize("לוחות זמנים")) ||
    n.includes(normalize("שיבוצ")) ||
    n.includes(normalize("משמר")) ||
    n.includes("calendar") ||
    n.includes("schedule") ||
    n.includes("shift");

  const mentionsEmployees =
    n.includes(normalize("עובד")) ||
    n.includes(normalize("עובדי")) ||
    n.includes(normalize("אנשי")) ||
    n.includes("employee") ||
    n.includes("employees") ||
    n.includes("staff");

  const matched =
    mentionsInactive && mentionsRemoval && mentionsCalendarOrShifts && mentionsEmployees;

  if (!matched) return { matched: false };

  return {
    matched: true,
    explanationHebrew:
      'זוהיתה כוונה: מחיקת כל משמרות השיבוץ מ־«היום» (UTC) ואילך לכל העובדים שסומנו במערכת כלא פעילים. הפעולה אינה מוחקת היסטוריה. יש להריץ מתוך «לבצע» לאחר אישור.',
  };
}
