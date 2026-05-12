/** Parse YYYY-MM-DD as UTC midnight (same semantics as schedule service). */
function utcDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error("invalid date");
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, deltaDays: number): string {
  const d = utcDay(isoDate);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return toIsoDate(d);
}

/** The Israeli calendar week Sun..Sat UTC that starts the Sunday after the current Sun–Sat week. */
export function nextIsraeliWeekUtcFromReference(ref: Date = new Date()): { weekStartSunday: string; days: string[] } {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const d = ref.getUTCDate();
  const dow = ref.getUTCDay();
  const thisSunday = new Date(Date.UTC(y, m, d - dow));
  const nextSunday = new Date(thisSunday);
  nextSunday.setUTCDate(thisSunday.getUTCDate() + 7);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(nextSunday);
    x.setUTCDate(nextSunday.getUTCDate() + i);
    days.push(toIsoDate(x));
  }
  return { weekStartSunday: days[0]!, days };
}

/** Short weekday label in Hebrew for a UTC calendar day (YYYY-MM-DD). */
export function hebrewWeekdayShort(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  return d.toLocaleDateString("he-IL", { weekday: "short", timeZone: "UTC" });
}
