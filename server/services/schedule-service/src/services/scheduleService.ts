import type { Types } from "mongoose";
import {
  AppError,
  DB_NAMES,
  getConnection,
  getScheduleModel,
  SCHEDULE_STATUSES,
  type ScheduleDoc,
  type ScheduleStatus,
} from "@syt/shared";
import { monthUtcRange, utcDay, utcDayEnd, weekRangeUtcContaining, toIsoDate, eachUtcDayInclusive } from "../utils/dateRange.js";
import * as notify from "./notificationClient.js";

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
  return { month: monthYm, days };
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
