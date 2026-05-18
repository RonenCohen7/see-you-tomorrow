const rawMs = Number(import.meta.env.VITE_SCHEDULE_SAVE_TIMEOUT_MS);
const fallbackMs = 3000;
/** Per-request axios timeout for schedule save mutations — fail fast versus global API timeout */
export const SCHEDULE_SAVE_TIMEOUT_MS = Math.min(
  Math.max(Number.isFinite(rawMs) && rawMs > 0 ? rawMs : fallbackMs, 2000),
  60_000,
);

/** Dev-only: quick GET `/health` on the gateway via Vite proxy before save — see `vite.config.ts` */
export function scheduleSaveDevHealthCheckEnabled(): boolean {
  return Boolean(import.meta.env.DEV && import.meta.env.VITE_SCHEDULE_SAVE_HEALTH_CHECK !== "0");
}

export async function assertScheduleSaveGatewayReachableDev(): Promise<void> {
  if (!scheduleSaveDevHealthCheckEnabled()) return;
  const ac = new AbortController();
  const budget = Math.min(1200, Math.max(500, SCHEDULE_SAVE_TIMEOUT_MS - 800));
  const tid = window.setTimeout(() => ac.abort(), budget);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/?$/, "/")}health`, {
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error("BAD_HEALTH");
  } catch {
    const err = Object.assign(new Error("DEV_GATEWAY_UNREACHABLE"), {
      code: "DEV_GATEWAY_UNREACHABLE",
    });
    throw err;
  } finally {
    window.clearTimeout(tid);
  }
}
