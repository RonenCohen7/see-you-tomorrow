import type { TFunction } from "i18next";
import type { AxiosInstance } from "axios";
import type { Employee, Role, Schedule } from "../types/models";
function scheduleStatusLabel(status: string, t: TFunction): string {
  switch (status) {
    case "office":
      return t("assistantStatusOffice");
    case "home":
      return t("assistantStatusHome");
    case "vacation":
      return t("assistantStatusVacation");
    case "sick":
      return t("assistantStatusSick");
    case "off":
      return t("assistantStatusOff");
    default:
      if (status.startsWith("custom:")) return t("assistantStatusCustom");
      return status;
  }
}

function scopeSuffix(t: TFunction): string {
  return t("assistantDataScopeNote");
}

async function fetchAllActiveEmployees(client: AxiosInstance): Promise<Employee[]> {
  const items: Employee[] = [];
  let page = 1;
  const limit = 400;
  for (;;) {
    const { data } = await client.get<{ items: Employee[]; total?: number }>(
      `/api/employees?page=${page}&limit=${limit}&isActive=true`,
    );
    items.push(...data.items);
    if (data.items.length < limit) break;
    page += 1;
    if (page > 50) break;
  }
  return items;
}

function uniqueEmployeesByStatus(items: Schedule[], status?: string): number {
  const set = new Set<string>();
  for (const row of items) {
    if (status !== undefined && row.status !== status) continue;
    set.add(row.employeeId);
  }
  return set.size;
}

export type BuiltinScheduleStatus = "office" | "home" | "vacation" | "sick" | "off";

export async function queryCountEmployeesByScheduleStatus(opts: {
  client: AxiosInstance;
  t: TFunction;
  dateIso: string;
  /** If set → single status count; if undefined → breakdown all statuses present + zeros for missing builtins only when asking "all"? We list every builtin with count (0 ok). */
  singleStatus?: BuiltinScheduleStatus | "custom:any";
}): Promise<string> {
  const { data } = await opts.client.get<{ date: string; items: Schedule[] }>(
    `/api/schedules/day/${encodeURIComponent(opts.dateIso)}`,
  );
  const items = data.items;
  const tm = opts.t;

  if (opts.singleStatus === "custom:any") {
    let n = 0;
    const seen = new Set<string>();
    for (const row of items) {
      if (!row.status.startsWith("custom:")) continue;
      seen.add(row.employeeId);
    }
    n = seen.size;
    return `${tm("assistantReplyCountGeneric", {
      label: tm("assistantStatusCustom"),
      date: data.date,
      count: n,
    })}\n${scopeSuffix(tm)}`;
  }

  if (opts.singleStatus) {
    const n = uniqueEmployeesByStatus(items, opts.singleStatus);
    return `${tm("assistantReplyCountGeneric", {
      label: scheduleStatusLabel(opts.singleStatus, tm),
      date: data.date,
      count: n,
    })}\n${scopeSuffix(tm)}`;
  }

  const builtinOrder: BuiltinScheduleStatus[] = ["office", "home", "vacation", "sick", "off"];
  const byBuiltin = new Map<BuiltinScheduleStatus, Set<string>>();
  for (const b of builtinOrder) byBuiltin.set(b, new Set());
  let custom = new Set<string>();
  for (const row of items) {
    if (builtinOrder.includes(row.status as BuiltinScheduleStatus)) {
      byBuiltin.get(row.status as BuiltinScheduleStatus)!.add(row.employeeId);
    } else if (row.status.startsWith("custom:")) {
      custom.add(row.employeeId);
    }
  }

  const lines: string[] = [];
  lines.push(tm("assistantReplyBreakdownIntro", { date: data.date }));
  for (const b of builtinOrder) {
    const c = byBuiltin.get(b)?.size ?? 0;
    lines.push(tm("assistantReplyBreakdownLine", { label: scheduleStatusLabel(b, tm), count: c }));
  }
  if (custom.size > 0) {
    lines.push(tm("assistantReplyBreakdownLine", { label: tm("assistantStatusCustom"), count: custom.size }));
  }
  lines.push(scopeSuffix(tm));
  return lines.join("\n");
}

export async function queryDepartmentVacationCount(opts: {
  client: AxiosInstance;
  t: TFunction;
  dateIso: string;
  departmentId: string;
  departmentName: string;
}): Promise<string> {
  const [dayRes, emps] = await Promise.all([
    opts.client.get<{ date: string; items: Schedule[] }>(
      `/api/schedules/day/${encodeURIComponent(opts.dateIso)}`,
    ),
    fetchAllActiveEmployees(opts.client),
  ]);

  const inDeptRoster = new Set(
    emps.filter((e) => e.departmentId === opts.departmentId).map((e) => e.id),
  );

  const seen = new Set<string>();
  for (const row of dayRes.data.items) {
    if (row.status !== "vacation") continue;
    if (!inDeptRoster.has(row.employeeId)) continue;
    seen.add(row.employeeId);
  }
  const n = seen.size;

  return `${opts.t("assistantReplyDeptVacation", {
    dept: opts.departmentName,
    date: dayRes.data.date,
    count: n,
  })}\n${scopeSuffix(opts.t)}`;
}

export async function queryManagerLeastOfficeDays(opts: {
  client: AxiosInstance;
  t: TFunction;
  role: Role;
  weekAnchorIso: string;
}): Promise<string> {
  if (opts.role === "employee") {
    return opts.t("assistantReplyManagerForbidden");
  }

  const [{ data }, emps] = await Promise.all([
    opts.client.get<{ start: string; end: string; schedules: Schedule[] }>(
      `/api/schedules/week/${encodeURIComponent(opts.weekAnchorIso)}`,
    ),
    fetchAllActiveEmployees(opts.client),
  ]);

  const managers = emps.filter((e) => e.role === "manager");
  if (managers.length === 0) {
    return opts.t("assistantReplyNoManagers");
  }

  const officeDays = new Map<string, Set<string>>();
  for (const m of managers) {
    officeDays.set(m.id, new Set());
  }

  for (const row of data.schedules) {
    if (row.status !== "office") continue;
    const set = officeDays.get(row.employeeId);
    if (!set) continue;
    set.add(row.workDate);
  }

  let min = Number.POSITIVE_INFINITY;
  const leaderboard: Employee[] = [];
  for (const m of managers) {
    const c = officeDays.get(m.id)?.size ?? 0;
    if (c < min) {
      min = c;
      leaderboard.length = 0;
      leaderboard.push(m);
    } else if (c === min) {
      leaderboard.push(m);
    }
  }

  leaderboard.sort((a, b) => a.fullName.localeCompare(b.fullName));

  const names = leaderboard.map((m) => m.fullName).join(", ");

  const weekLine = `${data.start} – ${data.end}`;
  let body: string;
  if (min === 0) {
    body = opts.t("assistantReplyManagerLeastOfficeZero", {
      names,
      week: weekLine,
      count: 0,
    });
  } else {
    body = opts.t("assistantReplyManagerLeastOffice", {
      names,
      week: weekLine,
      count: min,
    });
  }

  return `${body}\n${scopeSuffix(opts.t)}`;
}
