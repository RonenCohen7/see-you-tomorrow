const emp = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
const dept = () => process.env.DEPARTMENT_SERVICE_URL ?? "http://localhost:4003";
const sch = () => process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005";

export type ScheduleRow = {
  id: string;
  employeeId: string;
  departmentId?: string;
  workDate: string;
  status: string;
};

export type EmployeeRow = {
  id: string;
  fullName: string;
  role?: string;
  departmentId?: string;
  isActive?: boolean;
};

async function userGet<T>(authHeader: string, base: () => string, path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchScheduleDay(authHeader: string, dateIso: string) {
  return userGet<{ date: string; items: ScheduleRow[] }>(
    authHeader,
    sch,
    `/api/schedules/day/${encodeURIComponent(dateIso)}`,
  );
}

export async function fetchScheduleWeek(authHeader: string, anchorIso: string) {
  return userGet<{ start: string; end: string; schedules: ScheduleRow[] }>(
    authHeader,
    sch,
    `/api/schedules/week/${encodeURIComponent(anchorIso)}`,
  );
}

export async function fetchDepartments(authHeader: string) {
  return userGet<{ items: Array<{ id: string; name: string; isActive?: boolean }> }>(
    authHeader,
    dept,
    "/api/departments",
  );
}

export async function fetchActiveEmployees(authHeader: string, maxPages = 8) {
  const items: EmployeeRow[] = [];
  const limit = 400;
  for (let page = 1; page <= maxPages; page += 1) {
    const data = await userGet<{ items: EmployeeRow[] }>(
      authHeader,
      emp,
      `/api/employees?page=${page}&limit=${limit}&isActive=true`,
    );
    items.push(...data.items);
    if (data.items.length < limit) break;
  }
  return items;
}
