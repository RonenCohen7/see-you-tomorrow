import type { Response } from "express";
import {
  AppError,
  DB_NAMES,
  getConnection,
  getScheduleModel,
  requireAdmin,
  type AuthRequest,
  type ScheduleDoc,
} from "@syt/shared";
import {
  createScheduleSchema,
  createScheduleRangeSchema,
  departmentRangeApplySchema,
  departmentRangePreviewSchema,
  listQuerySchema,
  replaceScheduleRangeSchema,
  updateScheduleSchema,
  weekGridApplySchema,
} from "../validations/schedule.js";
import * as authz from "../services/scheduleAuthz.js";
import * as orgSettings from "../services/orgSettingsService.js";
import * as svc from "../services/scheduleService.js";
import * as empRemote from "../services/remoteEmployee.js";

export async function getOrgSettings(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const s = await orgSettings.getOrgSchedulesFull();
  res.json(s);
}

export async function patchOrgSettings(req: AuthRequest, res: Response) {
  if (req.body.managerCanEditSchedules !== undefined) {
    await orgSettings.setManagerCanEditSchedules(Boolean(req.body.managerCanEditSchedules));
  }

  const prefPatch: { preferenceMinDaysAhead?: number; preferenceRemindersEnabled?: boolean } = {};
  if (req.body.preferenceMinDaysAhead !== undefined) {
    const n = Number(req.body.preferenceMinDaysAhead);
    if (!Number.isFinite(n)) {
      throw new AppError(400, "preferenceMinDaysAhead לא מספר תקין", "VALIDATION");
    }
    prefPatch.preferenceMinDaysAhead = n;
  }
  if (req.body.preferenceRemindersEnabled !== undefined) {
    prefPatch.preferenceRemindersEnabled = Boolean(req.body.preferenceRemindersEnabled);
  }
  if (
    prefPatch.preferenceMinDaysAhead !== undefined ||
    prefPatch.preferenceRemindersEnabled !== undefined
  ) {
    await orgSettings.patchOrgSchedulesPrefs(prefPatch);
  }

  const s = await orgSettings.getOrgSchedulesFull();
  res.json(s);
}

export async function list(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "שאילתה לא תקינה", "VALIDATION", parsed.error.flatten());

  let employeeId = parsed.data.employeeId;
  let departmentId = parsed.data.departmentId;

  if (req.user.role === "employee") {
    employeeId = req.user.id;
    departmentId = undefined;
  } else if (req.user.role === "manager") {
    const me = await empRemote.fetchEmployeeInternal(req.user.id);
    departmentId = me?.departmentId;
    employeeId = undefined;
  }

  let items = await svc.listSchedules({
    ...parsed.data,
    employeeId,
    departmentId,
  });

  if (req.user.role !== "admin") {
    items = (await authz.filterSchedulesForUser(req.user.id, req.user.role, items)) as typeof items;
  }

  res.json({ items });
}

export async function day(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const date = req.params.date;
  await authz.assertCanReadSchedule({
    userId: req.user.id,
    role: req.user.role,
  });
  let items = await svc.dayView(date);
  if (req.user.role !== "admin") {
    items = (await authz.filterSchedulesForUser(req.user.id, req.user.role, items)) as typeof items;
  }
  res.json({ date, items });
}

export async function month(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  await authz.assertCanReadSchedule({ userId: req.user.id, role: req.user.role });
  const summary = await svc.monthSummary(req.params.month);

  if (req.user.role === "admin") {
    return res.json(summary);
  }

  const conn = await getConnection(DB_NAMES.schedules);
  const Schedule = getScheduleModel(conn);
  const { start, end } = await import("../utils/dateRange.js").then((m) => m.monthUtcRange(req.params.month));
  const docs = await Schedule.find({ workDate: { $gte: start, $lte: end } }).lean();
  let filtered = docs.map((d) => svc.toPublic(d as unknown as ScheduleDoc));
  filtered = (await authz.filterSchedulesForUser(req.user.id, req.user.role, filtered)) as typeof filtered;

  const dayMap = new Map<
    string,
    { office: number; home: number; vacation: number; sick: number; off: number; aiAssignments: number }
  >();
  for (const row of filtered) {
    const k = row.workDate;
    const cur =
      dayMap.get(k) ?? { office: 0, home: 0, vacation: 0, sick: 0, off: 0, aiAssignments: 0 };
    cur[row.status as "office" | "home" | "vacation" | "sick" | "off"]++;
    if (row.source === "ai") cur.aiAssignments++;
    dayMap.set(k, cur);
  }
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, counts]) => ({
    _id: date,
    ...counts,
  }));

  res.json({ month: req.params.month, days });
}

export async function week(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  await authz.assertCanReadSchedule({ userId: req.user.id, role: req.user.role });
  const data = await svc.weekView(req.params.date);
  let schedules = data.schedules;
  if (req.user.role !== "admin") {
    schedules = (await authz.filterSchedulesForUser(req.user.id, req.user.role, schedules)) as typeof schedules;
  }
  res.json({ ...data, schedules });
}

export async function create(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = createScheduleSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  let { departmentId, locationId } = parsed.data;
  const emp = await empRemote.fetchEmployeeInternal(parsed.data.employeeId);
  if (!departmentId && emp?.departmentId) departmentId = emp.departmentId;
  if (!locationId && emp?.locationId) locationId = emp.locationId;

  await authz.assertCanWriteSchedule({
    userId: req.user.id,
    role: req.user.role,
    targetEmployeeId: parsed.data.employeeId,
  });

  const result = await svc.createSchedule({
    ...parsed.data,
    departmentId,
    locationId,
    hours: parsed.data.hours,
    updatedBy: req.user.id,
  });
  res.status(201).json(result);
}

export async function createRange(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = createScheduleRangeSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  let { departmentId, locationId } = parsed.data;
  const emp = await empRemote.fetchEmployeeInternal(parsed.data.employeeId);
  if (!departmentId && emp?.departmentId) departmentId = emp.departmentId;
  if (!locationId && emp?.locationId) locationId = emp.locationId;

  await authz.assertCanWriteSchedule({
    userId: req.user.id,
    role: req.user.role,
    targetEmployeeId: parsed.data.employeeId,
  });

  const result = await svc.createSchedulesForDateRange({
    employeeId: parsed.data.employeeId,
    departmentId,
    locationId,
    workDateFrom: parsed.data.workDateFrom,
    workDateTo: parsed.data.workDateTo,
    status: parsed.data.status,
    hours: parsed.data.hours,
    note: parsed.data.note,
    updatedBy: req.user.id,
  });
  res.status(201).json(result);
}

export async function previewDepartmentRange(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = departmentRangePreviewSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  await authz.assertCanBulkWriteDepartmentSchedules({
    userId: req.user.id,
    role: req.user.role,
    departmentId: parsed.data.departmentId,
  });

  const result = await svc.previewDepartmentScheduleRange(parsed.data);
  res.json(result);
}

export async function applyDepartmentRange(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = departmentRangeApplySchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  await authz.assertCanBulkWriteDepartmentSchedules({
    userId: req.user.id,
    role: req.user.role,
    departmentId: parsed.data.departmentId,
  });

  for (const employeeId of parsed.data.includeEmployeeIds) {
    await authz.assertCanWriteSchedule({
      userId: req.user.id,
      role: req.user.role,
      targetEmployeeId: employeeId,
    });
  }

  const result = await svc.applyDepartmentScheduleRange({
    departmentId: parsed.data.departmentId,
    workDateFrom: parsed.data.workDateFrom,
    workDateTo: parsed.data.workDateTo,
    status: parsed.data.status,
    hours: parsed.data.hours,
    note: parsed.data.note,
    includeEmployeeIds: parsed.data.includeEmployeeIds,
    updatedBy: req.user.id,
  });
  res.json(result);
}

export async function applyWeekGrid(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = weekGridApplySchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  await authz.assertCanBulkWriteDepartmentSchedules({
    userId: req.user.id,
    role: req.user.role,
    departmentId: parsed.data.departmentId,
  });

  const uniqueEmployeeIds = [...new Set(parsed.data.cells.map((c) => c.employeeId))];
  for (const employeeId of uniqueEmployeeIds) {
    await authz.assertCanWriteSchedule({
      userId: req.user.id,
      role: req.user.role,
      targetEmployeeId: employeeId,
    });
  }

  const result = await svc.applyWeekGrid({
    departmentId: parsed.data.departmentId,
    weekStartSunday: parsed.data.weekStartSunday,
    cells: parsed.data.cells,
    updatedBy: req.user.id,
  });
  res.json(result);
}

export async function replaceRange(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = replaceScheduleRangeSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const existing = await svc.findScheduleById(req.params.id);
  if (!existing) throw new AppError(404, "לוח לא נמצא", "NOT_FOUND");

  await authz.assertCanWriteSchedule({
    userId: req.user.id,
    role: req.user.role,
    targetEmployeeId: existing.employeeId.toString(),
  });

  let { departmentId, locationId } = parsed.data;
  const emp = await empRemote.fetchEmployeeInternal(existing.employeeId.toString());
  if (!departmentId && emp?.departmentId) departmentId = emp.departmentId;
  if (!locationId && emp?.locationId) locationId = emp.locationId;

  const result = await svc.replaceEmployeeScheduleRangeFromAnchor(req.params.id, {
    workDateFrom: parsed.data.workDateFrom,
    workDateTo: parsed.data.workDateTo,
    status: parsed.data.status,
    hours: parsed.data.hours,
    note: parsed.data.note,
    departmentId,
    locationId,
    updatedBy: req.user.id,
  });
  res.json(result);
}

export async function update(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const parsed = updateScheduleSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const existing = await svc.findScheduleById(req.params.id);
  if (!existing) throw new AppError(404, "לוח לא נמצא", "NOT_FOUND");

  await authz.assertCanWriteSchedule({
    userId: req.user.id,
    role: req.user.role,
    targetEmployeeId: existing.employeeId.toString(),
  });

  const result = await svc.updateSchedule(req.params.id, {
    ...parsed.data,
    updatedBy: req.user.id,
    source: "manual",
    aiBatchId: null,
  });
  res.json(result);
}

export async function remove(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const existing = await svc.findScheduleById(req.params.id);
  if (!existing) throw new AppError(404, "לוח לא נמצא", "NOT_FOUND");

  await authz.assertCanWriteSchedule({
    userId: req.user.id,
    role: req.user.role,
    targetEmployeeId: existing.employeeId.toString(),
  });

  const result = await svc.deleteSchedule(req.params.id);
  res.json(result);
}

export const adminOnly = requireAdmin;
