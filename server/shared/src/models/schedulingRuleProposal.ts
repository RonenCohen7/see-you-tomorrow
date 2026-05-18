import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";
import { SCHEDULING_RULE_TYPES, type SchedulingRuleType } from "./schedulingRule.js";

export const PROPOSAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type SchedulingRuleProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export interface SchedulingRuleProposalDoc {
  _id: import("mongoose").Types.ObjectId;
  status: SchedulingRuleProposalStatus;
  ruleType: SchedulingRuleType;
  payload: Record<string, unknown>;
  isActive: boolean;
  explanationHe: string;
  explanationEn?: string;
  conflictingRuleIds: string[];
  createdBy: import("mongoose").Types.ObjectId;
  resolvedBy?: import("mongoose").Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schedulingRuleProposalSchema = new Schema<SchedulingRuleProposalDoc>(
  {
    status: { type: String, enum: PROPOSAL_STATUSES, default: "pending", required: true },
    ruleType: { type: String, enum: SCHEDULING_RULE_TYPES, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: true },
    explanationHe: { type: String, required: true },
    explanationEn: { type: String },
    conflictingRuleIds: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, required: true },
    resolvedBy: { type: Schema.Types.ObjectId },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

schedulingRuleProposalSchema.index({ status: 1, createdAt: -1 });

export function getSchedulingRuleProposalModel(conn: Connection): Model<SchedulingRuleProposalDoc> {
  return (
    conn.models.SchedulingRuleProposal ??
    conn.model<SchedulingRuleProposalDoc>("SchedulingRuleProposal", schedulingRuleProposalSchema)
  );
}
