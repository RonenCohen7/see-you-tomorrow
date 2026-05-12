const emp = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
const sch = () => process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005";
const loc = () => process.env.LOCATION_SERVICE_URL ?? "http://localhost:4004";
const secret = () => process.env.INTERNAL_SERVICE_SECRET ?? "";

async function internal(path: string, base: () => string) {
  const res = await fetch(`${base()}${path}`, {
    headers: { "x-internal-secret": secret() },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function loadDepartmentEmployees(departmentId: string) {
  const data = (await internal(`/internal/departments/${departmentId}/employees`, emp)) as {
    items: Array<{ id: string; fullName: string; jobTitle?: string; role?: string }>;
  } | null;
  return data?.items ?? [];
}

export async function loadLocationCapacity(locationId: string) {
  const data = (await internal(`/internal/locations/${locationId}`, loc)) as {
    capacity: number;
    name: string;
  } | null;
  return data;
}

export async function loadSchedulesRange(authHeader: string | undefined, query: string) {
  if (!authHeader) return [];
  const res = await fetch(`${sch()}/api/schedules?${query}`, {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: unknown[] };
  return data.items ?? [];
}

/** For recommend: use user JWT when present; otherwise schedule-service internal range (automation). */
export async function loadSchedulesRangeForRecommend(opts: {
  authHeader?: string;
  departmentId: string;
  from: string;
  to: string;
}) {
  if (opts.authHeader) {
    const query = `departmentId=${opts.departmentId}&from=${opts.from}&to=${opts.to}`;
    return loadSchedulesRange(opts.authHeader, query);
  }
  const data = (await internal(
    `/internal/schedules/department-range-for-ai?departmentId=${encodeURIComponent(
      opts.departmentId
    )}&from=${encodeURIComponent(opts.from)}&to=${encodeURIComponent(opts.to)}`,
    sch
  )) as { items?: unknown[] } | null;
  return data?.items ?? [];
}

export async function loadSchedulingRulesForRange(from: string, to: string) {
  const data = (await internal(`/internal/scheduling-rules/active?from=${from}&to=${to}`, sch)) as {
    items: unknown[];
  } | null;
  return data?.items ?? [];
}

export async function loadDepartmentPreferencesBetween(
  departmentId: string,
  from: string,
  to: string
) {
  const data = (await internal(
    `/internal/attendance-preferences/dept-range?departmentId=${departmentId}&from=${from}&to=${to}`,
    sch
  )) as { items: unknown[] } | null;
  return data?.items ?? [];
}
