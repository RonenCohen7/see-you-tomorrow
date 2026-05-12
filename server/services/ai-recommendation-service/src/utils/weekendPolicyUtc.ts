/**
 * Day-of-week for an ISO calendar date interpreted in UTC (YYYY-MM-DD).
 * 0 = Sunday … 6 = Saturday.
 */
export function utcDayOfWeekFromIso(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return dt.getUTCDay();
}

/**
 * Product weekend: Fri–Sat on the UTC calendar slice of each date row.
 * (Matches existing manager-coverage logic; refine later if you need TZ-aware Israel days.)
 */
export function isUtcFridayOrSaturday(dateIso: string): boolean {
  const dow = utcDayOfWeekFromIso(dateIso);
  return dow === 5 || dow === 6;
}
