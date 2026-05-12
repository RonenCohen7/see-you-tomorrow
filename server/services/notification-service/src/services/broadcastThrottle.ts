/** In-memory throttle per admin userId (fits single-instance deploy). */

const MIN_MS_DEFAULT = 30_000;
const lastByUser = new Map<string, number>();

export function canSendSystemBroadcast(userId: string, minMs: number = MIN_MS_DEFAULT): boolean {
  const now = Date.now();
  const prev = lastByUser.get(userId);
  if (prev !== undefined && now - prev < minMs) return false;
  lastByUser.set(userId, now);
  return true;
}
