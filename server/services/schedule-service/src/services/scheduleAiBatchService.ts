import {
  DB_NAMES,
  getConnection,
  getScheduleAiBatchModel,
  type ScheduleAiBatchCreationSource,
  type ScheduleAiBatchItem,
  type ScheduleAiBatchStatus,
} from "@syt/shared";
import type { Types } from "mongoose";
import mongoose from "mongoose";
import * as pref from "./attendancePreferenceService.js";

function toPublic(
  doc: import("@syt/shared").ScheduleAiBatchDoc & { _id: Types.ObjectId }
) {
  return {
    id: doc._id.toString(),
    departmentId: doc.departmentId.toString(),
    locationId: doc.locationId?.toString(),
    dateRange: doc.dateRange,
    proposedItems: doc.proposedItems,
    status: doc.status,
    createdBy: doc.createdBy.toString(),
    approvedBy: doc.approvedBy?.toString(),
    confidence: doc.confidence,
    model: doc.model,
    validationNotes: doc.validationNotes,
    creationSource: doc.creationSource,
    preferenceCycleId: doc.preferenceCycleId?.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function model() {
  const conn = await getConnection(DB_NAMES.schedules);
  return getScheduleAiBatchModel(conn);
}

/** משבצות שבהן עובד הגדיר העדפת יום במסמך מוגש לאותו שבוע UTC. */
function buildSubmittedPreferenceSlotSet(submittedDocs: Awaited<ReturnType<typeof pref.listDeptWeek>>) {
  const set = new Set<string>();
  for (const doc of submittedDocs) {
    for (const day of doc.days ?? []) {
      if (day.workDate && day.preference) set.add(`${doc.employeeId}|${day.workDate}`);
    }
  }
  return set;
}

export async function createBatch(input: {
  departmentId: string;
  locationId?: string;
  dateRange: { from: string; to: string };
  proposedItems: ScheduleAiBatchItem[];
  createdBy: string;
  status?: ScheduleAiBatchStatus;
  approvedBy?: string;
  confidence?: number;
  model?: string;
  validationNotes?: string[];
  creationSource?: ScheduleAiBatchCreationSource;
  preferenceCycleId?: string;
}) {
  const M = await model();
  const status: ScheduleAiBatchStatus =
    input.status ?? (input.approvedBy ? "approved" : "pending_manager");
  const doc = await M.create({
    departmentId: new mongoose.Types.ObjectId(input.departmentId),
    ...(input.locationId ? { locationId: new mongoose.Types.ObjectId(input.locationId) } : {}),
    dateRange: input.dateRange,
    proposedItems: input.proposedItems,
    status,
    createdBy: new mongoose.Types.ObjectId(input.createdBy),
    ...(input.approvedBy ? { approvedBy: new mongoose.Types.ObjectId(input.approvedBy) } : {}),
    confidence: input.confidence,
    model: input.model,
    validationNotes: input.validationNotes,
    ...(input.creationSource ? { creationSource: input.creationSource } : {}),
    ...(input.preferenceCycleId
      ? { preferenceCycleId: new mongoose.Types.ObjectId(input.preferenceCycleId) }
      : {}),
  });
  return doc._id.toString();
}

export async function approveBatch(batchId: string, approvedBy: string) {
  const M = await model();
  await M.updateOne(
    { _id: new mongoose.Types.ObjectId(batchId) },
    {
      $set: {
        status: "approved",
        approvedBy: new mongoose.Types.ObjectId(approvedBy),
        updatedAt: new Date(),
      },
    }
  );
}

export async function listDept(departmentId: string, limit = 20) {
  const M = await model();
  const docs = await M.find({ departmentId: new mongoose.Types.ObjectId(departmentId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return docs.map((d) => toPublic(d as import("@syt/shared").ScheduleAiBatchDoc & { _id: Types.ObjectId }));
}

export async function getById(batchId: string) {
  const M = await model();
  const doc = await M.findById(batchId).lean();
  return doc ? toPublic(doc as import("@syt/shared").ScheduleAiBatchDoc & { _id: Types.ObjectId }) : null;
}

export async function getLeanById(batchId: string) {
  const M = await model();
  return M.findById(batchId).lean();
}

export async function listPendingPreferencePipeline(departmentId: string | undefined, limit = 30) {
  const M = await model();
  const filter: Record<string, unknown> = {
    creationSource: "preference_pipeline",
    status: "pending_manager",
  };
  if (departmentId) {
    filter.departmentId = new mongoose.Types.ObjectId(departmentId);
  }
  const docs = await M.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

  return Promise.all(
    docs.map(async (raw) => {
      const publicBatch = toPublic(raw as import("@syt/shared").ScheduleAiBatchDoc & { _id: Types.ObjectId });
      const weekStartSunday = publicBatch.dateRange.from;
      const submitted = await pref.listDeptWeek(publicBatch.departmentId, weekStartSunday);
      const slots = buildSubmittedPreferenceSlotSet(submitted);
      return {
        ...publicBatch,
        proposedItems: publicBatch.proposedItems.map((p: ScheduleAiBatchItem) => ({
          ...p,
          preferenceSource: slots.has(`${p.employeeId}|${p.date}`) ? ("employee" as const) : ("none" as const),
        })),
      };
    })
  );
}

/** Overlap: batch range intersects [weekFrom, weekTo] inclusive ISO dates. */
export async function markPipelineBatchesSuperseded(
  departmentId: string,
  weekFromIso: string,
  weekToIso: string
) {
  const M = await model();
  const dept = new mongoose.Types.ObjectId(departmentId);
  await M.updateMany(
    {
      departmentId: dept,
      creationSource: "preference_pipeline",
      status: "pending_manager",
      "dateRange.from": { $lte: weekToIso },
      "dateRange.to": { $gte: weekFromIso },
    },
    {
      $set: {
        status: "superseded",
        validationNotes: ["הוחלף בהגשת העדפות חדשה לאותו שבוע."],
        updatedAt: new Date(),
      },
    }
  );
}

export async function rejectBatch(batchId: string) {
  const M = await model();
  const r = await M.updateOne(
    { _id: new mongoose.Types.ObjectId(batchId), status: "pending_manager" },
    { $set: { status: "rejected", updatedAt: new Date() } }
  );
  return r.modifiedCount > 0;
}
