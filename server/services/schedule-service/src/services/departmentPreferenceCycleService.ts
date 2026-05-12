import {
  AppError,
  DB_NAMES,
  getConnection,
  getDepartmentPreferenceCycleModel,
  type DepartmentPreferenceCycleDoc,
  type DepartmentPreferencePipelineStatus,
  type PreferenceCycleSummaryDoc,
  type ScheduleAiBatchItem,
} from "@syt/shared";
import type { Types } from "mongoose";
import mongoose from "mongoose";
import { israeliWeekDatesFromSundayUtc, utcDay } from "../utils/dateRange.js";
import * as pref from "./attendancePreferenceService.js";
import * as batchSvc from "./scheduleAiBatchService.js";

async function cycleModel() {
  const conn = await getConnection(DB_NAMES.schedules);
  return getDepartmentPreferenceCycleModel(conn);
}

/** סיכום משבצות רק של עובד אחד: השוואת proposedItems מהאצווה מול ההעדפות שמשתמש הגיש. */
export function summarizePreferenceVsRecommendationsForEmployee(input: {
  employeeId: string;
  recommendations: ScheduleAiBatchItem[];
  prefDays: Array<{ workDate: string; preference?: string }> | undefined;
}): PreferenceCycleSummaryDoc | undefined {
  const byDate = new Map<string, string>();
  for (const d of input.prefDays ?? []) {
    if (d.preference && typeof d.preference === "string") byDate.set(d.workDate, d.preference);
  }
  const mine = input.recommendations.filter((r) => r.employeeId === input.employeeId);
  if (mine.length === 0) return undefined;
  let matchedPreference = 0;
  let differsFromPreference = 0;
  let noSubmittedPreferenceForSlot = 0;
  for (const r of mine) {
    const pref = byDate.get(r.date);
    if (!pref) {
      noSubmittedPreferenceForSlot++;
      continue;
    }
    if (pref === r.recommendedStatus) matchedPreference++;
    else differsFromPreference++;
  }
  return {
    recommendationRows: mine.length,
    matchedPreference,
    differsFromPreference,
    noSubmittedPreferenceForSlot,
  };
}

function assertSunday(weekStartSunday: string) {
  if (utcDay(weekStartSunday).getUTCDay() !== 0) {
    throw new AppError(400, "weekStartSunday חייב להיות ראשון ב-UTC", "VALIDATION");
  }
}

async function weekIsoRange(weekStartSunday: string): Promise<{ from: string; to: string }> {
  assertSunday(weekStartSunday);
  const days = israeliWeekDatesFromSundayUtc(weekStartSunday);
  return { from: days[0]!, to: days[6]! };
}

/** Batches that overlap the Israeli week and await manager for the preference pipeline. */
export async function supersedeOpenPipelineBatches(departmentId: string, weekStartSunday: string) {
  const { from, to } = await weekIsoRange(weekStartSunday);
  await batchSvc.markPipelineBatchesSuperseded(departmentId, from, to);
}

export async function upsertQueuedOnSubmit(departmentId: string, weekStartSunday: string) {
  await supersedeOpenPipelineBatches(departmentId, weekStartSunday);

  const Cycle = await cycleModel();
  const doc = await Cycle.findOneAndUpdate(
    {
      departmentId: new mongoose.Types.ObjectId(departmentId),
      weekStartSunday,
    },
    {
      $set: {
        pipelineStatus: "queued" as DepartmentPreferencePipelineStatus,
        lastError: undefined,
      },
      $unset: { aiBatchId: "", preferenceSummary: "" },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return doc as DepartmentPreferenceCycleDoc & { _id: Types.ObjectId };
}

export async function findByDepartmentWeek(departmentId: string, weekStartSunday: string) {
  const Cycle = await cycleModel();
  return Cycle.findOne({
    departmentId: new mongoose.Types.ObjectId(departmentId),
    weekStartSunday,
  }).lean() as Promise<(DepartmentPreferenceCycleDoc & { _id: Types.ObjectId }) | null>;
}

export async function findByBatchId(batchId: string) {
  const Cycle = await cycleModel();
  return Cycle.findOne({ aiBatchId: new mongoose.Types.ObjectId(batchId) }).lean() as Promise<
    (DepartmentPreferenceCycleDoc & { _id: Types.ObjectId }) | null
  >;
}

export async function loadForUpdate(departmentId: string, weekStartSunday: string) {
  const Cycle = await cycleModel();
  return Cycle.findOne({
    departmentId: new mongoose.Types.ObjectId(departmentId),
    weekStartSunday,
  });
}

export async function markRunning(doc: import("mongoose").HydratedDocument<DepartmentPreferenceCycleDoc>) {
  doc.pipelineStatus = "ai_running";
  await doc.save();
}

export async function markFailed(doc: import("mongoose").HydratedDocument<DepartmentPreferenceCycleDoc>, message: string) {
  doc.pipelineStatus = "ai_failed";
  doc.lastError = message;
  await doc.save();
}

export async function markAwaitingManager(
  doc: import("mongoose").HydratedDocument<DepartmentPreferenceCycleDoc>,
  batchId: string,
  summary?: PreferenceCycleSummaryDoc
) {
  doc.pipelineStatus = "awaiting_manager";
  doc.aiBatchId = new mongoose.Types.ObjectId(batchId);
  if (summary) doc.preferenceSummary = summary;
  await doc.save();
}

export async function markAppliedForBatch(batchId: string) {
  const Cycle = await cycleModel();
  await Cycle.updateMany(
    { aiBatchId: new mongoose.Types.ObjectId(batchId) },
    { $set: { pipelineStatus: "applied" as DepartmentPreferencePipelineStatus, lastError: undefined } }
  );
}

export async function markRejectedForBatch(batchId: string) {
  const Cycle = await cycleModel();
  await Cycle.updateMany(
    { aiBatchId: new mongoose.Types.ObjectId(batchId) },
    { $set: { pipelineStatus: "rejected" as DepartmentPreferencePipelineStatus } }
  );
}

/** מצב צינור העדפות→AI למנהל/אדמין (לפי מחלקה ושבוע). */
export async function getPublicForDepartment(departmentId: string, weekStartSunday: string) {
  assertSunday(weekStartSunday);
  const cycle = await findByDepartmentWeek(departmentId, weekStartSunday);
  return {
    weekStartSunday,
    departmentId,
    pipelineStatus: cycle?.pipelineStatus ?? null,
    preferenceSummary: cycle?.preferenceSummary,
    lastError: cycle?.lastError,
    aiBatchId: cycle?.aiBatchId?.toString(),
  };
}

export async function getPublicForEmployee(employeeId: string, weekStartSunday: string) {
  const mine = await pref.getMine(employeeId, weekStartSunday);
  const deptId = mine?.departmentId;
  if (!deptId) {
    return {
      weekStartSunday,
      departmentId: undefined as string | undefined,
      pipelineStatus: undefined as DepartmentPreferencePipelineStatus | undefined,
      preferenceSummary: undefined as PreferenceCycleSummaryDoc | undefined,
      lastError: undefined as string | undefined,
    };
  }

  const cycle = await findByDepartmentWeek(deptId, weekStartSunday);
  /** לא מחזירים כאן סיכום מחלקתי — בעמוד העובד מוצג רק מה שקשור לשורות שלו אל מול ההעדפות שלו. */
  let preferenceSummary: PreferenceCycleSummaryDoc | undefined;
  const batchOid = cycle?.aiBatchId;
  if (
    batchOid &&
    mine?.status === "submitted" &&
    cycle?.pipelineStatus &&
    cycle.pipelineStatus !== "queued" &&
    cycle.pipelineStatus !== "ai_running"
  ) {
    const batch = await batchSvc.getById(batchOid.toString());
    if (batch?.proposedItems?.length) {
      preferenceSummary = summarizePreferenceVsRecommendationsForEmployee({
        employeeId,
        recommendations: batch.proposedItems,
        prefDays: mine.days,
      });
    }
  }

  return {
    weekStartSunday,
    departmentId: deptId,
    pipelineStatus: cycle?.pipelineStatus,
    preferenceSummary,
    lastError: cycle?.lastError,
    aiBatchId: cycle?.aiBatchId?.toString(),
  };
}
