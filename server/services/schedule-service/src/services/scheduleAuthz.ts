import type { Role } from "@syt/shared";
import { AppError } from "@syt/shared";
import * as settings from "./orgSettingsService.js";
import * as empRemote from "./remoteEmployee.js";

export type SchedulePublic = {
  id: string;
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDate: string;
  status: string;
  note?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function filterSchedulesForUser(
  userId: string,
  role: Role,
  items: SchedulePublic[]
): Promise<SchedulePublic[]> {
  if (role === "admin") return items;
  if (role === "employee") {
    return items.filter((i) => i.employeeId === userId);
  }
  if (role === "manager") {
    const me = await empRemote.fetchEmployeeInternal(userId);
    if (!me?.departmentId) return [];
    return items.filter((i) => i.departmentId === me.departmentId);
  }
  return [];
}

export async function assertCanReadSchedule(params: {
  userId: string;
  role: Role;
  targetEmployeeId?: string;
  departmentId?: string;
}) {
  if (params.role === "admin") return;

  if (params.role === "employee") {
    if (params.targetEmployeeId && params.targetEmployeeId !== params.userId) {
      const me = await empRemote.fetchEmployeeInternal(params.userId);
      const target = await empRemote.fetchEmployeeInternal(params.targetEmployeeId);
      if (me?.departmentId && target?.departmentId && me.departmentId === target.departmentId) {
        return;
      }
      throw new AppError(403, "אין הרשאה לצפות בלוח זה", "FORBIDDEN");
    }
    return;
  }

  if (params.role === "manager") {
    const me = await empRemote.fetchEmployeeInternal(params.userId);
    if (!me?.departmentId) throw new AppError(403, "אין הרשאה", "FORBIDDEN");
    if (!params.departmentId || params.departmentId === me.departmentId) return;
    if (params.targetEmployeeId) {
      const target = await empRemote.fetchEmployeeInternal(params.targetEmployeeId);
      if (target?.departmentId === me.departmentId) return;
    }
    throw new AppError(403, "אין הרשאה לצפות בלוח זה", "FORBIDDEN");
  }
}

export async function assertCanWriteSchedule(params: {
  userId: string;
  role: Role;
  targetEmployeeId: string;
}) {
  if (params.role === "admin") return;

  if (params.role === "manager") {
    const allow = await settings.getManagerCanEditSchedules();
    if (!allow) throw new AppError(403, "מנהלים לא יכולים לערוך לוחות זמנים", "FORBIDDEN");
    const me = await empRemote.fetchEmployeeInternal(params.userId);
    const target = await empRemote.fetchEmployeeInternal(params.targetEmployeeId);
    if (me?.departmentId && target?.departmentId && me.departmentId === target.departmentId) {
      return;
    }
    throw new AppError(403, "אין הרשאה לערוך לוח זה", "FORBIDDEN");
  }

  throw new AppError(403, "אין הרשאה לערוך לוח זה", "FORBIDDEN");
}
