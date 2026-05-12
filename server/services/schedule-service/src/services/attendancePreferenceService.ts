import {
  AppError,
  DB_NAMES,
  getConnection,
  getAttendancePreferenceModel,
  ATTENDANCE_PREFERENCE_STATUSES,
  type AttendancePreferenceDoc,
  type PreferenceDayEntry,
} from "@syt/shared";
import type { Types } from "mongoose";
import mongoose from "mongoose";
import { utcDay, addUtcDays, toIsoDate } from "../utils/dateRange.js";
import * as orgSettings from "./orgSettingsService.js";

async function model() {
  const conn = await getConnection(DB_NAMES.schedules);
  return getAttendancePreferenceModel(conn);
}

function utcTodayIso(ref = new Date()): string {
  return toIsoDate(new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate())));
}

/** Smallest UTC Sunday such that that week is at least `minDaysAhead` UTC days after today. */
export function earliestAllowedPreferenceWeekSunday(minDaysAhead: number, ref = new Date()): string {
  const today = utcTodayIso(ref);
  const cutoff = addUtcDays(today, minDaysAhead);
  const d = utcDay(cutoff);
  const dow = d.getUTCDay();
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  return addUtcDays(cutoff, daysToSunday);
}

function toPublic(doc: AttendancePreferenceDoc & { _id: Types.ObjectId }) {
  return {
    id: doc._id.toString(),
    employeeId: doc.employeeId.toString(),
    departmentId: doc.departmentId?.toString(),
    weekStartSunday: doc.weekStartSunday,
    days: doc.days,
    status: doc.status,
    lastPreferenceReminderAt: doc.lastPreferenceReminderAt,
    submittedAt: doc.submittedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function getMine(employeeId: string, weekStartSunday: string) {
  const M = await model();
  const doc = await M.findOne({
    employeeId: new mongoose.Types.ObjectId(employeeId),
    weekStartSunday,
  }).lean();
  return doc ? toPublic(doc as AttendancePreferenceDoc & { _id: Types.ObjectId }) : null;
}

export async function listDeptWeek(departmentId: string, weekStartSunday: string) {
  const M = await model();
  const docs = await M.find({
    departmentId: new mongoose.Types.ObjectId(departmentId),
    weekStartSunday,
    status: "submitted",
  }).lean();
  return docs.map((d) => toPublic(d as AttendancePreferenceDoc & { _id: Types.ObjectId }));
}

function weekOverlapsRange(weekStartSunday: string, rangeFrom: string, rangeTo: string): boolean {
  const weekEnd = addUtcDays(weekStartSunday, 6);
  return weekStartSunday <= rangeTo && weekEnd >= rangeFrom;
}

export async function listDeptIntersectingRange(departmentId: string, rangeFrom: string, rangeTo: string) {
  const M = await model();
  const docs = await M.find({
    departmentId: new mongoose.Types.ObjectId(departmentId),
    status: "submitted",
  })
    .sort({ updatedAt: -1 })
    .limit(120)
    .lean();
  const filtered = docs.filter((d) =>
    weekOverlapsRange((d as AttendancePreferenceDoc).weekStartSunday, rangeFrom, rangeTo)
  );
  return filtered.map((d) => toPublic(d as AttendancePreferenceDoc & { _id: Types.ObjectId }));
}

export async function upsertMine(input: {
  employeeId: string;
  departmentId?: string;
  weekStartSunday: string;
  days: PreferenceDayEntry[];
  submit: boolean;
}) {
  const d0 = utcDay(input.weekStartSunday);
  if (d0.getUTCDay() !== 0) throw new AppError(400, "weekStartSunday חייב להיות ראשון ב-UTC", "VALIDATION");

  const minDays = await orgSettings.getPreferenceMinDaysAhead();
  const earliest = earliestAllowedPreferenceWeekSunday(minDays);
  if (input.weekStartSunday < earliest) {
    throw new AppError(
      400,
      `ניתן להגיש העדפות רק החל מהשבוע של ${earliest} (מינימום ${minDays} ימים קדימה)`,
      "TOO_SOON"
    );
  }

  const seenDates = new Set<string>();
  for (const row of input.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.workDate)) {
      throw new AppError(400, "פורמט תאריך לא תקין", "VALIDATION");
    }
    if (seenDates.has(row.workDate)) throw new AppError(400, "כפילות תאריכים", "VALIDATION");
    seenDates.add(row.workDate);
    if (row.preference !== undefined && !ATTENDANCE_PREFERENCE_STATUSES.includes(row.preference)) {
      throw new AppError(400, "סטטוס העדפה לא תקין", "VALIDATION");
    }
  }

  const M = await model();
  const now = new Date();
  const doc = await M.findOneAndUpdate(
    { employeeId: new mongoose.Types.ObjectId(input.employeeId), weekStartSunday: input.weekStartSunday },
    {
      employeeId: new mongoose.Types.ObjectId(input.employeeId),
      departmentId: input.departmentId ? new mongoose.Types.ObjectId(input.departmentId) : undefined,
      weekStartSunday: input.weekStartSunday,
      days: input.days,
      status: input.submit ? "submitted" : "draft",
      ...(input.submit ? { submittedAt: now } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return toPublic(doc.toObject() as AttendancePreferenceDoc & { _id: Types.ObjectId });
}

export async function getMissingSubmissionEmployeeIds(weekStartSunday: string, candidateEmployeeIds: string[]) {
  if (candidateEmployeeIds.length === 0) return [];
  const M = await model();
  const oid = candidateEmployeeIds.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await M.find({
    weekStartSunday,
    employeeId: { $in: oid },
    status: "submitted",
  })
    .select("employeeId")
    .lean();
  const submitted = new Set(rows.map((r: { employeeId: Types.ObjectId }) => r.employeeId.toString()));
  return candidateEmployeeIds.filter((id) => !submitted.has(id));
}

export async function markReminderSent(ids: Types.ObjectId[]) {
  if (ids.length === 0) return;
  const M = await model();
  const now = new Date();
  await M.updateMany({ _id: { $in: ids } }, { $set: { lastPreferenceReminderAt: now } });
}
