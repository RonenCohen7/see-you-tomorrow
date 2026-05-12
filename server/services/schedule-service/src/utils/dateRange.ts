/** Parse YYYY-MM-DD as UTC midnight */
export function utcDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error("invalid date");
  return new Date(Date.UTC(y, m - 1, d));
}

/** End of UTC calendar day for inclusive range queries ($lte). */
export function utcDayEnd(isoDate: string): Date {
  const d = utcDay(isoDate);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function monthUtcRange(monthYm: string): { start: Date; end: Date } {
  const [y, m] = monthYm.split("-").map(Number);
  if (!y || !m) throw new Error("invalid month");
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

/** Week starting Monday UTC containing isoDate */
export function weekRangeUtcContaining(isoDate: string): { start: Date; end: Date } {
  const day = utcDay(isoDate);
  const dow = day.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = new Date(day);
  start.setUTCDate(day.getUTCDate() + mondayOffset);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of UTC calendar days from isoFrom through isoTo (YYYY-MM-DD). */
export function eachUtcDayInclusive(isoFrom: string, isoTo: string): string[] {
  const from = utcDay(isoFrom);
  const to = utcDay(isoTo);
  if (from.getTime() > to.getTime()) return [];
  const out: string[] = [];
  const cur = new Date(from);
  while (cur.getTime() <= to.getTime()) {
    out.push(toIsoDate(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function addUtcDays(isoDate: string, deltaDays: number): string {
  const d = utcDay(isoDate);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return toIsoDate(d);
}

/** Seven ISO dates Sun..Sat UTC starting at `weekStartSunday` (must be a UTC Sunday). */
export function israeliWeekDatesFromSundayUtc(weekStartSunday: string): string[] {
  const d = utcDay(weekStartSunday);
  if (d.getUTCDay() !== 0) throw new Error("weekStartSunday must be UTC Sunday");
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(addUtcDays(weekStartSunday, i));
  return out;
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
