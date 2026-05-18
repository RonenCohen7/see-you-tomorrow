import {
  AppError,
  DB_NAMES,
  detectActiveConflictingRules,
  getConnection,
  getSchedulingRuleProposalModel,
  SCHEDULING_RULE_TYPES,
  summarizeRule,
  type SchedulingRuleProposalDoc,
  type SchedulingRuleType,
} from "@syt/shared";
import mongoose, { type Types } from "mongoose";
import * as rules from "./schedulingRuleService.js";
import * as notify from "./notificationClient.js";

async function model() {
  const conn = await getConnection(DB_NAMES.schedules);
  return getSchedulingRuleProposalModel(conn);
}

function toPublic(doc: SchedulingRuleProposalDoc & { _id: Types.ObjectId }) {
  return {
    id: doc._id.toString(),
    status: doc.status,
    ruleType: doc.ruleType,
    payload: doc.payload,
    isActive: doc.isActive,
    explanationHe: doc.explanationHe,
    explanationEn: doc.explanationEn,
    conflictingRuleIds: doc.conflictingRuleIds,
    createdBy: doc.createdBy.toString(),
    resolvedBy: doc.resolvedBy?.toString(),
    resolvedAt: doc.resolvedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listProposals(status?: "pending" | "approved" | "rejected") {
  const M = await model();
  const q = status ? { status } : {};
  const docs = await M.find(q).sort({ createdAt: -1 }).limit(100).lean();
  return docs.map((d) => toPublic(d as SchedulingRuleProposalDoc & { _id: Types.ObjectId }));
}

export async function getProposal(id: string) {
  const M = await model();
  const doc = await M.findById(id).lean();
  if (!doc) return null;
  return toPublic(doc as SchedulingRuleProposalDoc & { _id: Types.ObjectId });
}

export async function createProposal(input: {
  ruleType: SchedulingRuleType;
  payload: Record<string, unknown>;
  isActive?: boolean;
  explanationHe: string;
  explanationEn?: string;
  createdByUserId: string;
  locationNames?: Array<{ id: string; name: string }>;
}) {
  if (!SCHEDULING_RULE_TYPES.includes(input.ruleType)) {
    throw new AppError(400, "סוג חוק לא תקין", "VALIDATION");
  }
  rules.validateRulePayload(input.ruleType, input.payload);

  const all = await rules.listRules();
  const conflicts = detectActiveConflictingRules(
    { ruleType: input.ruleType, payload: input.payload },
    all,
  );
  if (conflicts.length === 0) {
    throw new AppError(400, "אין סתירה — ניתן לשמור את החוק ישירות", "VALIDATION");
  }

  const M = await model();
  const doc = await M.create({
    status: "pending",
    ruleType: input.ruleType,
    payload: input.payload,
    isActive: input.isActive ?? true,
    explanationHe: input.explanationHe,
    explanationEn: input.explanationEn,
    conflictingRuleIds: conflicts.map((c) => c.id),
    createdBy: new mongoose.Types.ObjectId(input.createdByUserId),
  });

  const pub = toPublic(doc.toObject() as SchedulingRuleProposalDoc & { _id: Types.ObjectId });
  const localeMap = new Map((input.locationNames ?? []).map((l) => [l.id, l.name]));
  const summary = summarizeRule(
    { ruleType: input.ruleType, payload: input.payload },
    "he",
    localeMap,
  );

  await notify.notifySchedulingRuleProposal({
    proposalId: pub.id,
    summary,
    conflictCount: conflicts.length,
    submitterUserId: input.createdByUserId,
  });

  return pub;
}

export async function approveProposal(id: string, resolvedByUserId: string) {
  const M = await model();
  const doc = await M.findById(id);
  if (!doc) throw new AppError(404, "הצעה לא נמצאה", "NOT_FOUND");
  if (doc.status !== "pending") {
    throw new AppError(400, "ההצעה כבר טופלה", "VALIDATION");
  }

  for (const cid of doc.conflictingRuleIds) {
    try {
      await rules.deleteRule(cid);
    } catch {
      /* rule may already be removed */
    }
  }

  const created = await rules.createRule({
    ruleType: doc.ruleType as SchedulingRuleType,
    payload: doc.payload as Record<string, unknown>,
    isActive: doc.isActive,
  });

  doc.status = "approved";
  doc.resolvedBy = new mongoose.Types.ObjectId(resolvedByUserId);
  doc.resolvedAt = new Date();
  await doc.save();

  return { proposal: toPublic(doc.toObject() as SchedulingRuleProposalDoc & { _id: Types.ObjectId }), rule: created };
}

export async function rejectProposal(id: string, resolvedByUserId: string) {
  const M = await model();
  const doc = await M.findById(id);
  if (!doc) throw new AppError(404, "הצעה לא נמצאה", "NOT_FOUND");
  if (doc.status !== "pending") {
    throw new AppError(400, "ההצעה כבר טופלה", "VALIDATION");
  }
  doc.status = "rejected";
  doc.resolvedBy = new mongoose.Types.ObjectId(resolvedByUserId);
  doc.resolvedAt = new Date();
  await doc.save();
  return toPublic(doc.toObject() as SchedulingRuleProposalDoc & { _id: Types.ObjectId });
}

/** Submit flow: no conflict → create rule; conflict → proposal + notify. */
export async function submitRule(input: {
  ruleType: SchedulingRuleType;
  payload: Record<string, unknown>;
  isActive?: boolean;
  explanationHe?: string;
  explanationEn?: string;
  createdByUserId: string;
  locationNames?: Array<{ id: string; name: string }>;
}): Promise<
  | { outcome: "created"; rule: Awaited<ReturnType<typeof rules.createRule>> }
  | { outcome: "proposal"; proposal: Awaited<ReturnType<typeof createProposal>> }
> {
  rules.validateRulePayload(input.ruleType, input.payload);
  const all = await rules.listRules();
  const active = input.isActive !== false;
  const conflicts = active
    ? detectActiveConflictingRules({ ruleType: input.ruleType, payload: input.payload }, all)
    : [];

  if (conflicts.length === 0) {
    const rule = await rules.createRule({
      ruleType: input.ruleType,
      payload: input.payload,
      isActive: input.isActive ?? true,
    });
    return { outcome: "created", rule };
  }

  const proposal = await createProposal({
    ruleType: input.ruleType,
    payload: input.payload,
    isActive: input.isActive,
    explanationHe: input.explanationHe ?? "",
    explanationEn: input.explanationEn,
    createdByUserId: input.createdByUserId,
    locationNames: input.locationNames,
  });
  return { outcome: "proposal", proposal };
}
