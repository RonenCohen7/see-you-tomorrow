import {
  AppError,
  DB_NAMES,
  getConnection,
  getSchedulingRuleModel,
  SCHEDULING_RULE_TYPES,
  type SchedulingRuleDoc,
  type SchedulingRuleType,
} from "@syt/shared";
import type { Types } from "mongoose";
import mongoose from "mongoose";
import { filterRulesForRange } from "./schedulingRuleResolve.js";

async function model() {
  const conn = await getConnection(DB_NAMES.schedules);
  return getSchedulingRuleModel(conn);
}

function toPublic(doc: SchedulingRuleDoc & { _id: Types.ObjectId }) {
  return {
    id: doc._id.toString(),
    ruleType: doc.ruleType,
    payload: doc.payload,
    isActive: doc.isActive,
    priority: doc.priority,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listRules() {
  const M = await model();
  const docs = await M.find().sort({ priority: -1, createdAt: -1 }).lean();
  return docs.map((d) => toPublic(d as SchedulingRuleDoc & { _id: Types.ObjectId }));
}

export async function listActiveForRange(fromIso: string, toIso: string) {
  const M = await model();
  const docs = await M.find({ isActive: true }).lean();
  return filterRulesForRange(docs as SchedulingRuleDoc[], fromIso, toIso);
}

export async function hasActiveRuleType(ruleType: SchedulingRuleType): Promise<boolean> {
  const M = await model();
  const n = await M.countDocuments({ ruleType, isActive: true });
  return n > 0;
}

export async function createRule(input: {
  ruleType: SchedulingRuleType;
  payload: Record<string, unknown>;
  isActive?: boolean;
  priority?: number;
}) {
  if (!SCHEDULING_RULE_TYPES.includes(input.ruleType)) {
    throw new AppError(400, "סוג חוק לא תקין", "VALIDATION");
  }
  validatePayload(input.ruleType, input.payload);
  const M = await model();
  const doc = await M.create({
    ruleType: input.ruleType,
    payload: input.payload,
    isActive: input.isActive ?? true,
    priority: input.priority ?? 0,
  });
  return toPublic(doc.toObject() as SchedulingRuleDoc & { _id: Types.ObjectId });
}

export async function updateRule(
  id: string,
  patch: Partial<{ payload: Record<string, unknown>; isActive: boolean; priority: number }>
) {
  const M = await model();
  const doc = await M.findById(id);
  if (!doc) throw new AppError(404, "חוק לא נמצא", "NOT_FOUND");
  if (patch.payload !== undefined) {
    validatePayload(doc.ruleType as SchedulingRuleType, patch.payload);
    doc.payload = patch.payload;
  }
  if (patch.isActive !== undefined) doc.isActive = patch.isActive;
  if (patch.priority !== undefined) doc.priority = patch.priority;
  await doc.save();
  return toPublic(doc.toObject() as SchedulingRuleDoc & { _id: Types.ObjectId });
}

export async function deleteRule(id: string) {
  const M = await model();
  await M.findByIdAndDelete(new mongoose.Types.ObjectId(id));
}

const objectIdRegex = /^[a-f\d]{24}$/i;

function validatePayload(ruleType: SchedulingRuleType, payload: Record<string, unknown>) {
  if (ruleType === "location_unavailable") {
    const loc = payload.locationId;
    const from = payload.effectiveFrom;
    const to = payload.effectiveTo;
    if (typeof loc !== "string" || !objectIdRegex.test(loc)) {
      throw new AppError(400, "חובה locationId תקין", "VALIDATION");
    }
    if (typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      throw new AppError(400, "חובה effectiveFrom בתבנית תאריך", "VALIDATION");
    }
    if (to !== undefined && to !== null) {
      if (typeof to !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        throw new AppError(400, "effectiveTo בתבנית תאריך", "VALIDATION");
      }
      if (from > to) throw new AppError(400, "effectiveFrom לא אחרי effectiveTo", "VALIDATION");
    }
  }
  if (ruleType === "min_managers_office_daily") {
    const n = payload.minManagers;
    if (typeof n !== "number" || n < 0 || n > 50) {
      throw new AppError(400, "minManagers לא תקין", "VALIDATION");
    }
  }
  if (ruleType === "manager_office_auto_parking") {
    if (payload == null || typeof payload !== "object") {
      throw new AppError(400, "חובה לשלוח payload", "VALIDATION");
    }
    const keys = Object.keys(payload as object);
    if (keys.length > 0) {
      throw new AppError(400, "סוג חוק זה לא מקבל פרמטרים ב-payload", "VALIDATION");
    }
  }
}
