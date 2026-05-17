import type { AuthRequest } from "@syt/shared";
import { AppError, extractBearer } from "@syt/shared";
import {
  fetchAllEmployees,
  fetchParkingReservations,
  fetchParkingSpots,
  fetchSchedules,
  type ParkingReservation,
  type ParkingSpot,
  type ScheduleRow,
} from "./upstream.js";

export const REPORT_STATUSES = ["office", "home", "vacation", "sick"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const STATUS_TITLE_HE: Record<ReportStatus, string> = {
  office: "משרד",
  home: "בית",
  vacation: "חופשה",
  sick: "מחלה",
};

export function statusTitleHe(status: ReportStatus): string {
  return STATUS_TITLE_HE[status];
}

function authHeader(req: AuthRequest): string {
  const t = extractBearer(req);
  if (!t) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  return `Bearer ${t}`;
}

export async function buildDailyStatusRows(
  req: AuthRequest,
  from: string,
  to: string,
  status: ReportStatus,
  employeeId?: string
) {
  const auth = authHeader(req);
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
  return { rows, title: statusTitleHe(status), filterEmployeeId, filterEmployeeName };
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
