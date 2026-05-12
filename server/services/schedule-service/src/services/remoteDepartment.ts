/** Fetch department meta for schedule-service internals (cron / workers). */
const depBase = () => process.env.DEPARTMENT_SERVICE_URL ?? "http://localhost:4003";

export async function fetchDepartmentPublic(id: string) {
  try {
    const res = await fetch(`${depBase()}/internal/departments/${id}`, {
      headers: { "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET ?? "" },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ id?: string; locationId?: string; managerId?: string }>;
  } catch {
    return null;
  }
}
