const cache = new Map<string, { role: string; ts: number }>();
const TTL_MS = 60_000;

function cacheSet(email: string, role: string) {
  cache.set(email, { role, ts: Date.now() });
}

/** True if employee with this email is admin or manager (cached ~60s). Used to skip login/forgot rate limits. */
export async function isAdminOrManagerCached(email: string): Promise<boolean> {
  const key = email.trim().toLowerCase();
  if (!key) return false;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < TTL_MS) {
    return hit.role === "admin" || hit.role === "manager";
  }

  const base = process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
  const secret = process.env.INTERNAL_SERVICE_SECRET ?? "";
  const url = `${base}/internal/employees/by-email?email=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, {
      headers: { "x-internal-secret": secret },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      cacheSet(key, "employee");
      return false;
    }
    const data = (await res.json()) as { role?: string };
    const role = typeof data.role === "string" ? data.role : "employee";
    cacheSet(key, role);
    return role === "admin" || role === "manager";
  } catch {
    return false;
  }
}
