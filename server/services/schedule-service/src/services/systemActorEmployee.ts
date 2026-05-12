/** Employee id used as createdBy for automation (AI batch from preference pipeline). */

const empBase = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";

async function fetchFirstAdminId(): Promise<string | undefined> {
  try {
    const res = await fetch(`${empBase()}/internal/employees/admins`, {
      headers: { "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET ?? "" },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { ids?: string[] };
    return data.ids?.[0];
  } catch {
    return undefined;
  }
}

export async function resolveSystemActorEmployeeId(): Promise<string> {
  const env = process.env.SYSTEM_ACTOR_EMPLOYEE_ID?.trim();
  if (env && /^[a-f\d]{24}$/i.test(env)) return env;
  const fallback = await fetchFirstAdminId();
  if (fallback && /^[a-f\d]{24}$/i.test(fallback)) return fallback;
  throw new Error(
    "Missing SYSTEM_ACTOR_EMPLOYEE_ID and no admin employee id available for preference AI pipeline"
  );
}
