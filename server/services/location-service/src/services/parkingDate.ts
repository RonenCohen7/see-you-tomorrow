/** Match schedule-service utcDay for parking reservation dates */
export function utcDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error("invalid date");
  return new Date(Date.UTC(y, m - 1, d));
}
