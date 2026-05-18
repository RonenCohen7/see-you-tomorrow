import type { AuthRequest } from "@syt/shared";
import {
  AppError,
  CUSTOM_SCHEDULE_STATUS_PREFIX,
  extractBearer,
  isBuiltinScheduleStatus,
  isValidStoredScheduleStatus,
} from "@syt/shared";

import type { ScheduleRow } from "./upstream.js";
import {
  fetchAllEmployees,
  fetchParkingReservations,
  fetchParkingSpots,
  fetchSchedules,
  fetchScheduleOrgSettings,
  type OrgScheduleSettingsLite,
  type ParkingReservation,
  type ParkingSpot,
} from "./upstream.js";

const BUILTIN_TITLE_HE = {
  office: "משרד",
  home: "בית",
  vacation: "חופשה",
  sick: "מחלה",
  off: "לא עובדים",
} as const;

function authHeader(req: AuthRequest): string {
  const t = extractBearer(req);
  if (!t) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  return `Bearer ${t}`;
}

export function titleForDailyReport(status: string, org: OrgScheduleSettingsLite): string {
  if (isBuiltinScheduleStatus(status)) {
    return BUILTIN_TITLE_HE[status];
  }
  if (!status.startsWith(CUSTOM_SCHEDULE_STATUS_PREFIX)) return status;
  const idHex = status.slice(CUSTOM_SCHEDULE_STATUS_PREFIX.length);
  const c = org.customScheduleStatuses.find((x) => x.id.toLowerCase() === idHex.toLowerCase());
  return (c?.labelHe && c.labelHe.trim()) || status;
}

export function assertValidDailyReportStatus(status: string, org: OrgScheduleSettingsLite): void {
  if (!isValidStoredScheduleStatus(status)) {
    throw new AppError(400, "סטטוס לא תקין", "VALIDATION");
  }
  const disB = new Set(org.disabledBuiltinScheduleStatuses ?? []);
  if (isBuiltinScheduleStatus(status)) {
    if (disB.has(status)) throw new AppError(400, "סטטוס לא בתוקף", "VALIDATION");
    return;
  }
  const idHex = status.slice(CUSTOM_SCHEDULE_STATUS_PREFIX.length);
  const c = org.customScheduleStatuses.find((x) => x.id.toLowerCase() === idHex.toLowerCase());
  if (!c || c.disabled) throw new AppError(400, "סטטוס לא בתוקף או לא קיים", "VALIDATION");
}

export async function buildDailyStatusRows(
  req: AuthRequest,
  from: string,
  to: string,
  status: string,
  employeeId?: string
) {
  const auth = authHeader(req);
  const org = await fetchScheduleOrgSettings(auth);
  assertValidDailyReportStatus(status, org);
  const title = titleForDailyReport(status, org);

  const [schedules, employees] = await Promise.all([
    fetchSchedules(auth, { from, to, status, employeeId }),
    fetchAllEmployees(auth),
  ]);
  const inactiveEmpIds = new Set(employees.filter((e) => e.isActive === false).map((e) => e.id));
  const schedulesForReport = schedules.filter((s) => !inactiveEmpIds.has(s.employeeId));
  const empMap = new Map(employees.map((e) => [e.id, e.fullName || e.email]));
  let filterEmployeeId: string | undefined;
  let filterEmployeeName: string | undefined;
  if (employeeId) {
    filterEmployeeId = employeeId;
    filterEmployeeName = empMap.get(employeeId) ?? employeeId;
  }
  const rows = schedulesForReport.map((s: ScheduleRow) => ({
    fullName: empMap.get(s.employeeId) ?? s.employeeId,
    workDate: s.workDate,
  }));
  rows.sort((a, b) => {
    const c = a.workDate.localeCompare(b.workDate);
    if (c !== 0) return c;
    return a.fullName.localeCompare(b.fullName, "he");
  });
  return { rows, title, filterEmployeeId, filterEmployeeName };
}

export type ParkingReportRow = {
  spotLabel: string;
  locationName: string;
  ownerName: string;
  assigneeName: string;
  workDate: string;
  hoursText: string;
};

function hoursText(r: ParkingReservation): string {
  if (r.hourStart == null && r.hourEnd == null) return "יום מלא";
  const a = r.hourStart ?? "";
  const b = r.hourEnd ?? "";
  return `${a}–${b}`;
}

export async function buildParkingRows(req: AuthRequest, from: string, to: string): Promise<ParkingReportRow[]> {
  const auth = authHeader(req);
  const [spots, reservations, employees] = await Promise.all([
    fetchParkingSpots(auth),
    fetchParkingReservations(auth, from, to),
    fetchAllEmployees(auth),
  ]);
  const empMap = new Map(employees.map((e) => [e.id, e.fullName || e.email]));
  const inactiveEmpIds = new Set(employees.filter((e) => e.isActive === false).map((e) => e.id));
  const allowedIds = new Set(employees.map((e) => e.id));
  const isManager = req.user?.role === "manager";

  const spotById = new Map(spots.map((s: ParkingSpot) => [s.id, s]));

  const out: ParkingReportRow[] = [];
  for (const r of reservations) {
    if (inactiveEmpIds.has(r.employeeId)) continue;
    if (isManager && !allowedIds.has(r.employeeId)) continue;
    const spot = spotById.get(r.spotId);
    if (!spot) continue;
    const ownerId = spot.assignedEmployeeId;
    const ownerName = ownerId ? (empMap.get(ownerId) ?? "—") : "—";
    const assigneeName = (r.guestFullName && r.guestFullName.trim()) || empMap.get(r.employeeId) || r.employeeId;
    out.push({
      spotLabel: spot.label,
      locationName: spot.locationName || "",
      ownerName,
      assigneeName,
      workDate: r.workDate,
      hoursText: hoursText(r),
    });
  }
  out.sort((a, b) => {
    const d = a.workDate.localeCompare(b.workDate);
    if (d !== 0) return d;
    return `${a.locationName}${a.spotLabel}`.localeCompare(`${b.locationName}${b.spotLabel}`, "he");
  });
  return out;
}
