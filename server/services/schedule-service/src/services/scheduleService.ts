import type { Types } from "mongoose";
import mongoose from "mongoose";
import {
  AppError,
  DB_NAMES,
  getConnection,
  getScheduleModel,
  SCHEDULE_STATUSES,
  type ScheduleDoc,
  type ScheduleSource,
  type ScheduleStatus,
} from "@syt/shared";
import {
  monthUtcRange,
  utcDay,
  utcDayEnd,
  weekRangeUtcContaining,
  toIsoDate,
  eachUtcDayInclusive,
  israeliWeekDatesFromSundayUtc,
} from "../utils/dateRange.js";
import * as notify from "./notificationClient.js";
import { fetchEmployeesByDepartment } from "./remoteEmployee.js";

export function toPublic(doc: ScheduleDoc) {
  return {
    id: doc._id.toString(),
    employeeId: doc.employeeId.toString(),
    departmentId: doc.departmentId?.toString(),
    locationId: doc.locationId?.toString(),
    workDate: toIsoDate(doc.workDate instanceof Date ? doc.workDate : new Date(doc.workDate)),
    status: doc.status,
    hours: doc.hours,
    note: doc.note,
    updatedBy: doc.updatedBy?.toString(),
    source: doc.source ?? "manual",
    aiBatchId: doc.aiBatchId?.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function model() {
  const conn = await getConnection(DB_NAMES.schedules);
  return getScheduleModel(conn);
}

export async function findScheduleById(id: string) {
  const Schedule = await model();
  return Schedule.findById(id);
}

export async function createSchedule(
  input: {
    employeeId: string;
    departmentId?: string;
    locationId?: string;
    workDate: string;
    status: ScheduleStatus;
    hours?: number;
    note?: string;
    updatedBy?: string;
    source?: ScheduleSource;
    aiBatchId?: string;
  },
  options?: { skipNotify?: boolean }
) {
  const Schedule = await model();
  const workDate = utcDay(input.workDate);
  const doc = await Schedule.create({
    employeeId: input.employeeId,
    departmentId: input.departmentId,
    locationId: input.locationId,
    workDate,
    status: input.status,
    hours: input.hours,
    note: input.note,
    updatedBy: input.updatedBy,
    source: input.source ?? "manual",
    ...(input.aiBatchId ? { aiBatchId: new mongoose.Types.ObjectId(input.aiBatchId) } : {}),
  });
  const pub = toPublic(doc);
  if (!options?.skipNotify) {
    await notify.notifyScheduleChange({
      scheduleId: pub.id,
      employeeId: pub.employeeId,
      departmentId: pub.departmentId,
      locationId: pub.locationId,
      workDate: pub.workDate,
      status: pub.status,
      updatedBy: input.updatedBy,
      note: input.note,
    });
  }
  return pub;
}

export async function updateSchedule(
  id: string,
  input: Partial<{
    departmentId: string;
    locationId: string;
    workDate: string;
    status: ScheduleStatus;
    hours: number;
    note: string;
    updatedBy: string;
    source: ScheduleSource;
    aiBatchId: string | null;
  }>,
  options?: { skipNotify?: boolean }
) {
  const Schedule = await model();
  const doc = await Schedule.findById(id);
  if (!doc) throw new AppError(404, "לוח לא נמצא", "NOT_FOUND");

  if (input.workDate) doc.workDate = utcDay(input.workDate);
  if (input.departmentId !== undefined) doc.departmentId = input.departmentId as unknown as Types.ObjectId;
  if (input.locationId !== undefined) doc.locationId = input.locationId as unknown as Types.ObjectId;
  if (input.status !== undefined) doc.status = input.status;
  if (input.hours !== undefined) doc.hours = input.hours;
  if (input.note !== undefined) doc.note = input.note;
  if (input.updatedBy !== undefined) doc.updatedBy = input.updatedBy as unknown as Types.ObjectId;
  if (input.source !== undefined) doc.source = input.source;
  if (input.aiBatchId !== undefined) {
    doc.aiBatchId = input.aiBatchId
      ? (new mongoose.Types.ObjectId(input.aiBatchId) as unknown as ScheduleDoc["aiBatchId"])
      : undefined;
  }

  await doc.save();

  const pub = toPublic(doc);
  if (!options?.skipNotify) {
    await notify.notifyScheduleChange({
      scheduleId: pub.id,
      employeeId: pub.employeeId,
      departmentId: pub.departmentId,
      locationId: pub.locationId,
      workDate: pub.workDate,
      status: pub.status,
      updatedBy: input.updatedBy ?? doc.updatedBy?.toString(),
      note: pub.note,
    });
  }
  return pub;
}

export async function deleteSchedule(id: string) {
  const Schedule = await model();
  const doc = await Schedule.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, "לוח לא נמצא", "NOT_FOUND");
  const pub = toPublic(doc);
  await notify.notifyScheduleChange({
    scheduleId: pub.id,
    employeeId: pub.employeeId,
    departmentId: pub.departmentId,
    locationId: pub.locationId,
    workDate: pub.workDate,
    status: "off",
    updatedBy: pub.updatedBy,
    note: "Schedule deleted",
  });
  return { id: pub.id };
}

/** מוחק את כל רשומות השיבוץ של העובד באותו יום UTC ואז יוצר רשומה אחת. */
export async function setEmployeeDayStatus(input: {
  employeeId: string;
  workDate: string;
  status: ScheduleStatus;
  departmentId?: string;
  locationId?: string;
  hours?: number;
  note?: string;
  updatedBy?: string;
}) {
  const Schedule = await model();
  const start = utcDay(input.workDate);
  const end = utcDayEnd(input.workDate);
  await Schedule.deleteMany({
    employeeId: input.employeeId,
    workDate: { $gte: start, $lte: end },
  });
  return createSchedule({
    employeeId: input.employeeId,
    departmentId: input.departmentId,
    locationId: input.locationId,
    workDate: input.workDate,
    status: input.status,
    hours: input.hours,
    note: input.note,
    updatedBy: input.updatedBy,
  });
}

export async function listSchedules(filter: {
  employeeId?: string;
  departmentId?: string;
  locationId?: string;
  status?: ScheduleStatus;
  from?: string;
  to?: string;
}) {
  const Schedule = await model();
  const q: Record<string, unknown> = {};
  if (filter.employeeId) q.employeeId = filter.employeeId;
  if (filter.departmentId) q.departmentId = filter.departmentId;
  if (filter.locationId) q.locationId = filter.locationId;
  if (filter.status) q.status = filter.status;
  if (filter.from || filter.to) {
    q.workDate = {};
    if (filter.from) (q.workDate as Record<string, Date>).$gte = utcDay(filter.from);
    if (filter.to) (q.workDate as Record<string, Date>).$lte = utcDayEnd(filter.to);
  }
  const docs = await Schedule.find(q).sort({ workDate: 1 }).lean();
  return docs.map((d) => toPublic(d as unknown as ScheduleDoc));
}

export async function dayView(isoDate: string) {
  const Schedule = await model();
  const day = utcDay(isoDate);
  const docs = await Schedule.find({ workDate: day }).lean();
  return docs.map((d) => toPublic(d as unknown as ScheduleDoc));
}

export async function monthSummary(monthYm: string) {
  const Schedule = await model();
  const { start, end } = monthUtcRange(monthYm);
  // Use $addToSet on employeeId per status so split-day entries don't double-count
  const pipeline = [
    { $match: { workDate: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$workDate" } },
          status: "$status",
        },
        employees: { $addToSet: "$employeeId" },
      },
    },
    {
      $group: {
        _id: "$_id.day",
        byStatus: {
          $push: { status: "$_id.status", count: { $size: "$employees" } },
        },
      },
    },
    { $sort: { _id: 1 as const } },
  ];
  type AggRow = {
    _id: string;
    byStatus: { status: string; count: number }[];
  };
  const rows = await Schedule.aggregate<AggRow>(pipeline);
  const days = rows.map((r) => {
    const counts: Record<string, number> = { office: 0, home: 0, vacation: 0, sick: 0, off: 0 };
    for (const s of r.byStatus) counts[s.status] = s.count;
    return { _id: r._id, ...counts } as {
      _id: string;
      office: number;
      home: number;
      vacation: number;
      sick: number;
      off: number;
    };
  });
  type AiAgg = { _id: string; aiAssignments: number };
  const aiAgg = await Schedule.aggregate<AiAgg>([
    {
      $match: {
        workDate: { $gte: start, $lte: end },
        source: "ai",
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$workDate" },
        },
        aiAssignments: { $sum: 1 },
      },
    },
  ]);
  const byDayAi = new Map(aiAgg.map((r) => [r._id, r.aiAssignments]));
  return {
    month: monthYm,
    days: days.map((d) => ({ ...d, aiAssignments: byDayAi.get(d._id) ?? 0 })),
  };
}

export async function weekView(isoDate: string) {
  const Schedule = await model();
  const { start, end } = weekRangeUtcContaining(isoDate);
  const docs = await Schedule.find({ workDate: { $gte: start, $lte: end } })
    .sort({ workDate: 1 })
    .lean();
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
    schedules: docs.map((d) => toPublic(d as unknown as ScheduleDoc)),
  };
}

export async function upsertBulkInternal(
  items: Array<{
    employeeId: string;
    workDate: string;
    status: ScheduleStatus;
    hours?: number;
    departmentId?: string;
    locationId?: string;
    note?: string;
    updatedBy?: string;
    source?: ScheduleSource;
    aiBatchId?: string;
  }>,
  options?: { skipNotifications?: boolean }
) {
  const results = [];
  for (const item of items) {
    const Schedule = await model();
    const workDate = utcDay(item.workDate);
    // Match an existing entry with the same employee+day+status (so split segments stay separate)
    const existing = await Schedule.findOne({
      employeeId: item.employeeId,
      workDate,
      status: item.status,
    });
    if (existing) {
      if (item.hours !== undefined) existing.hours = item.hours;
      if (item.departmentId !== undefined) existing.departmentId = item.departmentId as unknown as Types.ObjectId;
      if (item.locationId !== undefined) existing.locationId = item.locationId as unknown as Types.ObjectId;
      if (item.note !== undefined) existing.note = item.note;
      if (item.updatedBy !== undefined) existing.updatedBy = item.updatedBy as unknown as Types.ObjectId;
      if (item.source !== undefined) existing.source = item.source;
      if (item.aiBatchId !== undefined && item.aiBatchId) {
        existing.aiBatchId = new mongoose.Types.ObjectId(item.aiBatchId) as unknown as Types.ObjectId & ScheduleDoc["aiBatchId"];
      }
      await existing.save();
      results.push(toPublic(existing));
    } else {
      const doc = await createSchedule(
        {
          employeeId: item.employeeId,
          departmentId: item.departmentId,
          locationId: item.locationId,
          workDate: item.workDate,
          status: item.status,
          hours: item.hours,
          note: item.note,
          updatedBy: item.updatedBy,
          source: item.source,
          aiBatchId: item.aiBatchId,
        },
        { skipNotify: true }
      );
      results.push(doc);
    }
  }
  if (!options?.skipNotifications) {
    for (const r of results) {
      await notify.notifyScheduleChange({
        scheduleId: r.id,
        employeeId: r.employeeId,
        departmentId: r.departmentId,
        locationId: r.locationId,
        workDate: r.workDate,
        status: r.status,
        updatedBy: undefined,
        note: r.note,
      });
    }
  }
  return results;
}

const MAX_SCHEDULE_RANGE_DAYS = 400;

export async function createSchedulesForDateRange(input: {
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDateFrom: string;
  workDateTo: string;
  status: ScheduleStatus;
  hours?: number;
  note?: string;
  updatedBy?: string;
}) {
  const days = eachUtcDayInclusive(input.workDateFrom, input.workDateTo);
  if (days.length === 0) throw new AppError(400, "תאריך הסיום לפני תאריך ההתחלה", "VALIDATION");
  if (days.length > MAX_SCHEDULE_RANGE_DAYS) {
    throw new AppError(400, `טווח של יותר מ־${MAX_SCHEDULE_RANGE_DAYS} ימים אינו נתמך`, "VALIDATION");
  }

  const items = days.map((workDate) => ({
    employeeId: input.employeeId,
    departmentId: input.departmentId,
    locationId: input.locationId,
    workDate,
    status: input.status,
    hours: input.hours,
    note: input.note,
    updatedBy: input.updatedBy,
  }));

  const results = await upsertBulkInternal(items, { skipNotifications: true });
  const first = results[0];
  if (first) {
    await notify.notifyScheduleRangeChange({
      scheduleId: first.id,
      employeeId: input.employeeId,
      departmentId: input.departmentId,
      locationId: input.locationId,
      workDateFrom: days[0]!,
      workDateTo: days[days.length - 1]!,
      dayCount: days.length,
      status: input.status,
      updatedBy: input.updatedBy,
      note: input.note,
    });
  }

  return { items: results, count: results.length };
}

/**
 * Replace all schedule rows for an employee in [workDateFrom, workDateTo] with a uniform status,
 * anchored from an existing schedule row. Deletes the anchor if its date falls outside the range.
 */
export async function replaceEmployeeScheduleRangeFromAnchor(
  anchorScheduleId: string,
  input: {
    workDateFrom: string;
    workDateTo: string;
    status: ScheduleStatus;
    hours?: number;
    note?: string;
    updatedBy?: string;
    departmentId?: string;
    locationId?: string;
  }
) {
  const Schedule = await model();
  const anchor = await Schedule.findById(anchorScheduleId);
  if (!anchor) throw new AppError(404, "לוח לא נמצא", "NOT_FOUND");

  const from = input.workDateFrom <= input.workDateTo ? input.workDateFrom : input.workDateTo;
  const to = input.workDateFrom <= input.workDateTo ? input.workDateTo : input.workDateFrom;
  const origIso = toIsoDate(anchor.workDate instanceof Date ? anchor.workDate : new Date(anchor.workDate));

  const rangeStart = utcDay(from);
  const rangeEnd = utcDayEnd(to);

  await Schedule.deleteMany({
    employeeId: anchor.employeeId,
    workDate: { $gte: rangeStart, $lte: rangeEnd },
  });

  const origInRange = origIso >= from && origIso <= to;
  if (!origInRange) {
    await Schedule.deleteOne({ _id: anchor._id });
  }

  const deptId = input.departmentId ?? anchor.departmentId?.toString();
  const locId = input.locationId ?? anchor.locationId?.toString();

  return createSchedulesForDateRange({
    employeeId: anchor.employeeId.toString(),
    departmentId: deptId,
    locationId: locId,
    workDateFrom: from,
    workDateTo: to,
    status: input.status,
    hours: input.hours,
    note: input.note,
    updatedBy: input.updatedBy,
  });
}

/** מחיקת כל השיבוצים של העובד בטווח ואז יצירת טווח אחיד (ללא שורת עוגן). */
export async function replaceEmployeeSchedulesInRangeByEmployeeId(
  employeeId: string,
  input: {
    workDateFrom: string;
    workDateTo: string;
    status: ScheduleStatus;
    hours?: number;
    note?: string;
    departmentId?: string;
    locationId?: string;
    updatedBy?: string;
  }
) {
  const from = input.workDateFrom <= input.workDateTo ? input.workDateFrom : input.workDateTo;
  const to = input.workDateFrom <= input.workDateTo ? input.workDateTo : input.workDateFrom;

  const Schedule = await model();
  await Schedule.deleteMany({
    employeeId,
    workDate: { $gte: utcDay(from), $lte: utcDayEnd(to) },
  });

  return createSchedulesForDateRange({
    employeeId,
    departmentId: input.departmentId,
    locationId: input.locationId,
    workDateFrom: from,
    workDateTo: to,
    status: input.status,
    hours: input.hours,
    note: input.note,
    updatedBy: input.updatedBy,
  });
}

export type DepartmentSchedulePreviewRow = {
  employeeId: string;
  fullName: string;
  suggestedInclude: boolean;
  flags: string[];
  daysSummary: { workDate: string; statuses: string[] }[];
};

export async function previewDepartmentScheduleRange(params: {
  departmentId: string;
  workDateFrom: string;
  workDateTo: string;
}): Promise<{
  departmentId: string;
  from: string;
  to: string;
  employees: DepartmentSchedulePreviewRow[];
}> {
  const from = params.workDateFrom <= params.workDateTo ? params.workDateFrom : params.workDateTo;
  const to = params.workDateFrom <= params.workDateTo ? params.workDateTo : params.workDateFrom;
  const days = eachUtcDayInclusive(from, to);
  if (days.length === 0) throw new AppError(400, "תאריך הסיום לפני תאריך ההתחלה", "VALIDATION");
  if (days.length > MAX_SCHEDULE_RANGE_DAYS) {
    throw new AppError(400, `טווח של יותר מ־${MAX_SCHEDULE_RANGE_DAYS} ימים אינו נתמך`, "VALIDATION");
  }

  const employees = await fetchEmployeesByDepartment(params.departmentId);
  const empIds = employees.map((e) => e.id);
  if (empIds.length === 0) {
    return { departmentId: params.departmentId, from, to, employees: [] };
  }

  const Schedule = await model();
  const rangeStart = utcDay(from);
  const rangeEnd = utcDayEnd(to);

  const docs = await Schedule.find({
    employeeId: { $in: empIds },
    workDate: { $gte: rangeStart, $lte: rangeEnd },
  })
    .select("employeeId workDate status")
    .lean();

  const byEmp = new Map<string, Map<string, Set<string>>>();
  for (const row of docs) {
    const rawE = row.employeeId as unknown as { toString(): string };
    const eid = typeof rawE === "string" ? rawE : rawE.toString();
    const rawW = row.workDate;
    const wd = toIsoDate(rawW instanceof Date ? rawW : new Date(rawW));
    if (!byEmp.has(eid)) byEmp.set(eid, new Map());
    const dm = byEmp.get(eid)!;
    if (!dm.has(wd)) dm.set(wd, new Set());
    dm.get(wd)!.add(String(row.status));
  }

  const rows: DepartmentSchedulePreviewRow[] = [];
  for (const emp of employees.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "he"))) {
    const dayMap = byEmp.get(emp.id) ?? new Map();
    let hasProtected = false;
    let hasOther = false;
    const daysSummary: { workDate: string; statuses: string[] }[] = [];

    for (const wd of [...dayMap.keys()].sort((a, b) => a.localeCompare(b))) {
      const st = dayMap.get(wd)!;
      const statuses = [...st].sort();
      daysSummary.push({ workDate: wd, statuses });
      for (const s of statuses) {
        if (s === "vacation" || s === "sick") hasProtected = true;
        if (s !== "vacation" && s !== "sick") hasOther = true;
      }
    }

    const flags: string[] = [];
    if (hasProtected) flags.push("vacation_or_sick_in_range");
    if (hasOther) flags.push("has_other_schedules");

    const suggestedInclude = !hasProtected;

    rows.push({
      employeeId: emp.id,
      fullName: emp.fullName || emp.email || emp.id,
      suggestedInclude,
      flags,
      daysSummary,
    });
  }

  return { departmentId: params.departmentId, from, to, employees: rows };
}

const MAX_DEPT_BULK_EMPLOYEES = 200;

export async function applyDepartmentScheduleRange(params: {
  departmentId: string;
  workDateFrom: string;
  workDateTo: string;
  status: ScheduleStatus;
  hours?: number;
  note?: string;
  includeEmployeeIds: string[];
  updatedBy: string;
}): Promise<{ applied: number; skipped: number }> {
  const from = params.workDateFrom <= params.workDateTo ? params.workDateFrom : params.workDateTo;
  const to = params.workDateFrom <= params.workDateTo ? params.workDateTo : params.workDateFrom;
  const days = eachUtcDayInclusive(from, to);
  if (days.length === 0) throw new AppError(400, "תאריך הסיום לפני תאריך ההתחלה", "VALIDATION");
  if (days.length > MAX_SCHEDULE_RANGE_DAYS) {
    throw new AppError(400, `טווח של יותר מ־${MAX_SCHEDULE_RANGE_DAYS} ימים אינו נתמך`, "VALIDATION");
  }
  if (params.includeEmployeeIds.length > MAX_DEPT_BULK_EMPLOYEES) {
    throw new AppError(400, "יותר מדי עובדים בבקשה אחת", "VALIDATION");
  }

  const employees = await fetchEmployeesByDepartment(params.departmentId);
  const allowed = new Set(employees.map((e) => e.id));
  for (const id of params.includeEmployeeIds) {
    if (!allowed.has(id)) throw new AppError(400, "עובד לא שייך למחלקה שנבחרה", "VALIDATION");
  }

  let applied = 0;
  for (const employeeId of params.includeEmployeeIds) {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) continue;
    await replaceEmployeeSchedulesInRangeByEmployeeId(employeeId, {
      workDateFrom: from,
      workDateTo: to,
      status: params.status,
      hours: params.hours,
      note: params.note,
      departmentId: params.departmentId,
      locationId: emp.locationId,
      updatedBy: params.updatedBy,
    });
    applied += 1;
  }

  return { applied, skipped: employees.length - applied };
}

const MAX_WEEK_GRID_CELLS = 400;

export async function applyWeekGrid(params: {
  departmentId: string;
  weekStartSunday: string;
  cells: { employeeId: string; workDate: string; status: ScheduleStatus }[];
  updatedBy: string;
}): Promise<{ updated: number; skippedProtected: number }> {
  let weekDays: string[];
  try {
    weekDays = israeliWeekDatesFromSundayUtc(params.weekStartSunday);
  } catch {
    throw new AppError(400, "ראש השבוע חייב להיות יום ראשון (UTC)", "VALIDATION");
  }
  const allowedDays = new Set(weekDays);
  if (params.cells.length > MAX_WEEK_GRID_CELLS) {
    throw new AppError(400, "יותר מדי תאים בשיבוץ השבועי", "VALIDATION");
  }

  const cellMap = new Map<string, { employeeId: string; workDate: string; status: ScheduleStatus }>();
  for (const c of params.cells) {
    if (!allowedDays.has(c.workDate)) {
      throw new AppError(400, "תאריך מחוץ לשבוע שנבחר", "VALIDATION");
    }
    cellMap.set(`${c.employeeId}|${c.workDate}`, c);
  }
  const deduped = [...cellMap.values()];

  const employees = await fetchEmployeesByDepartment(params.departmentId);
  const allowedEmp = new Set(employees.map((e) => e.id));
  const empById = new Map(employees.map((e) => [e.id, e] as const));
  for (const c of deduped) {
    if (!allowedEmp.has(c.employeeId)) throw new AppError(400, "עובד לא שייך למחלקה שנבחרה", "VALIDATION");
  }

  const rangeStart = utcDay(weekDays[0]!);
  const rangeEnd = utcDayEnd(weekDays[6]!);
  const empIdsForQuery = [...new Set(deduped.map((c) => c.employeeId))];

  const Schedule = await model();
  const protDocs = await Schedule.find({
    employeeId: { $in: empIdsForQuery },
    workDate: { $gte: rangeStart, $lte: rangeEnd },
    status: { $in: ["vacation", "sick"] },
  })
    .select("employeeId workDate")
    .lean();

  const protectedCells = new Set<string>();
  for (const row of protDocs) {
    const eid = row.employeeId?.toString();
    if (!eid) continue;
    const raw = row.workDate;
    const wd = toIsoDate(raw instanceof Date ? raw : new Date(raw));
    protectedCells.add(`${eid}|${wd}`);
  }

  let updated = 0;
  let skippedProtected = 0;
  for (const cell of deduped) {
    const key = `${cell.employeeId}|${cell.workDate}`;
    if (protectedCells.has(key)) {
      skippedProtected += 1;
      continue;
    }
    const emp = empById.get(cell.employeeId);
    if (!emp) continue;
    await setEmployeeDayStatus({
      employeeId: cell.employeeId,
      workDate: cell.workDate,
      status: cell.status,
      departmentId: params.departmentId,
      locationId: emp.locationId,
      updatedBy: params.updatedBy,
    });
    updated += 1;
  }

  return { updated, skippedProtected };
}

/** For each (employeeId, workDate): true if any schedule row that day has status office. */
export async function officePresenceBatch(
  checks: { employeeId: string; workDate: string }[]
): Promise<{ employeeId: string; workDate: string; hasOffice: boolean }[]> {
  if (checks.length === 0) return [];
  const Schedule = await model();
  const empIds = [...new Set(checks.map((c) => c.employeeId))];
  const dateStrs = [...new Set(checks.map((c) => c.workDate))];
  const dates = dateStrs.map((d) => utcDay(d));
  const docs = await Schedule.find({
    employeeId: { $in: empIds },
    workDate: { $in: dates },
    status: "office",
  })
    .select("employeeId workDate")
    .lean();

  const officeSet = new Set<string>();
  for (const row of docs) {
    const eid = row.employeeId?.toString();
    const raw = row.workDate;
    const wd = toIsoDate(raw instanceof Date ? raw : new Date(raw));
    if (eid) officeSet.add(`${eid}|${wd}`);
  }

  return checks.map(({ employeeId, workDate }) => ({
    employeeId,
    workDate,
    hasOffice: officeSet.has(`${employeeId}|${workDate}`),
  }));
}

export { SCHEDULE_STATUSES };
