import { internalServiceHeaders } from "@syt/shared";

const locBase = () => process.env.LOCATION_SERVICE_URL ?? "http://localhost:4004";

/** Company-wide fallback when a department has no location of its own. */
export async function fetchDefaultLocationId(): Promise<string | undefined> {
  try {
    const res = await fetch(`${locBase()}/internal/locations`, {
      headers: internalServiceHeaders(),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { items?: Array<{ id?: string }> };
    return data.items?.find((l) => l.id)?.id;
  } catch {
    return undefined;
  }
}
