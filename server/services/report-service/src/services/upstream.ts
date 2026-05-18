import { AppError } from "@syt/shared";
import { employeeBase, locationBase, scheduleBase } from "../config/urls.js";

export type ScheduleRow = {
  id: string;
  employeeId: string;
  workDate: string;
  status: string;
};

export type EmployeeRow = { id: string; fullName: string; email: string; isActive?: boolean };

export type OrgScheduleSettingsLite = {
  disabledBuiltinScheduleStatuses?: string[];
  customScheduleStatuses: { id: string; labelHe: string; labelEn?: string; disabled?: boolean }[];
};

export async function fetchScheduleOrgSettings(authHeader: string): Promise<OrgScheduleSettingsLite> {
  const url = `${scheduleBase()}/api/schedules/org-settings`;
  const res = await fetch(url, { headers: { Authorization: authHeader } });
  if (!res.ok) {
    const t = await res.text();
    throw new AppError(res.status === 401 || res.status === 403 ? res.status : 502, t.slice(0, 500), "UPSTREAM");
  }
  const data = (await res.json()) as OrgScheduleSettingsLite & {
    managerCanEditSchedules?: boolean;
    preferenceMinDaysAhead?: number;
    preferenceRemindersEnabled?: boolean;
  };
  return {
    disabledBuiltinScheduleStatuses: Array.isArray(data.disabledBuiltinScheduleStatuses)
      ? data.disabledBuiltinScheduleStatuses
      : [],
    customScheduleStatuses: Array.isArray(data.customScheduleStatuses) ? data.customScheduleStatuses : [],
  };
}

export async function fetchSchedules(
  authHeader: string,
  params: { from: string; to: string; status: string; employeeId?: string }
) {
  const q = new URLSearchParams({ from: params.from, to: params.to, status: params.status });
  if (params.employeeId) q.set("employeeId", params.employeeId);
  const url = `${scheduleBase()}/api/schedules?${q.toString()}`;
  const res = await fetch(url, { headers: { Authorization: authHeader } });
  if (!res.ok) {
    const t = await res.text();
    throw new AppError(res.status === 401 || res.status === 403 ? res.status : 502, t.slice(0, 500), "UPSTREAM");
  }
  const data = (await res.json()) as { items: ScheduleRow[] };
  return data.items ?? [];
}

export async function fetchAllEmployees(authHeader: string): Promise<EmployeeRow[]> {
  const all: EmployeeRow[] = [];
  let page = 1;
  const limit = 100;
  for (;;) {
    const url = `${employeeBase()}/api/employees?page=${page}&limit=${limit}`;
    const res = await fetch(url, { headers: { Authorization: authHeader } });
    if (!res.ok) {
      const t = await res.text();
      throw new AppError(res.status === 401 || res.status === 403 ? res.status : 502, t.slice(0, 500), "UPSTREAM");
    }
    const data = (await res.json()) as { items: EmployeeRow[]; total: number };
    all.push(...data.items);
    if (all.length >= data.total || data.items.length === 0) break;
    page += 1;
  }
  return all;
}

export type ParkingSpot = {
  id: string;
  locationId: string;
  locationName: string;
  label: string;
  assignedEmployeeId?: string;
};

export type ParkingReservation = {
  id: string;
  spotId: string;
  employeeId: string;
  guestFullName?: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
};

export async function fetchParkingSpots(authHeader: string): Promise<ParkingSpot[]> {
  const res = await fetch(`${locationBase()}/api/parking/spots`, { headers: { Authorization: authHeader } });
  if (!res.ok) {
    const t = await res.text();
    throw new AppError(res.status === 401 || res.status === 403 ? res.status : 502, t.slice(0, 500), "UPSTREAM");
  }
  const data = (await res.json()) as { items: ParkingSpot[] };
  return data.items ?? [];
}

export async function fetchParkingReservations(authHeader: string, from: string, to: string): Promise<ParkingReservation[]> {
  const q = new URLSearchParams({ from, to });
  const res = await fetch(`${locationBase()}/api/parking/reservations?${q}`, { headers: { Authorization: authHeader } });
  if (!res.ok) {
    const t = await res.text();
    throw new AppError(res.status === 401 || res.status === 403 ? res.status : 502, t.slice(0, 500), "UPSTREAM");
  }
  const data = (await res.json()) as { items: ParkingReservation[] };
  return data.items ?? [];
}
