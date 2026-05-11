/** Parse YYYY-MM-DD as UTC midnight */
export function utcDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error("invalid date");
  return new Date(Date.UTC(y, m - 1, d));
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
