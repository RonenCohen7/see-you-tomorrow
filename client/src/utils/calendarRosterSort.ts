import type { Employee, Schedule } from "../types/models";

/** Matches common team-lead wording in Hebrew/English job titles. */
const TEAM_LEAD_TITLE_RE =
  /\b(team\s*lead|team\s*leader|group\s*lead|tech\s*lead|scrum\s*master)\b|ראש\s*צוות|ראשי\s*צוות|מוביל(?:ת)?\s+צוות|ר["׳']?צ\b/i;

/** Lower rank sorts first: admins/managers, then team-lead-like titles, then everyone else. */
export function calendarRosterSortRank(employee: Employee | undefined): number {
  if (!employee || !employee.isActive) return 50;
  if (employee.role === "admin") return 0;
  if (employee.role === "manager") return 1;
  if (employee.jobTitle?.trim() && TEAM_LEAD_TITLE_RE.test(employee.jobTitle)) return 2;
  return 10;
}

export function compareSchedulesForCalendarRoster(
  a: Schedule,
  b: Schedule,
  employeeMap: Map<string, Employee>,
  sortLocale: string
): number {
  const ra = calendarRosterSortRank(employeeMap.get(a.employeeId));
  const rb = calendarRosterSortRank(employeeMap.get(b.employeeId));
  if (ra !== rb) return ra - rb;
  const na = employeeMap.get(a.employeeId)?.fullName?.trim() || a.employeeId;
  const nb = employeeMap.get(b.employeeId)?.fullName?.trim() || b.employeeId;
  return na.localeCompare(nb, sortLocale, { sensitivity: "base", numeric: true });
}
