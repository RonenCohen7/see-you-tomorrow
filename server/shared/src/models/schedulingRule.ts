import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

/** Extensible rule kinds — validator + AI context resolve by ruleType + payload shape. */
export const SCHEDULING_RULE_TYPES = [
  "location_unavailable",
  "min_managers_office_daily",
  /** Behavioral: when active, reserving a temporary parking slot for manager/admin rows with office+locationID (handled by schedule → location sync). Not used for AI validation. */
  "manager_office_auto_parking",
] as const;
export type SchedulingRuleType = (typeof SCHEDULING_RULE_TYPES)[number];

export interface SchedulingRuleDoc {
  _id: import("mongoose").Types.ObjectId;
  ruleType: SchedulingRuleType;
  /** Typed per ruleType — e.g. location_unavailable: { locationId, effectiveFrom, effectiveTo?, note? } */
  payload: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const schedulingRuleSchema = new Schema<SchedulingRuleDoc>(
  {
    ruleType: { type: String, enum: SCHEDULING_RULE_TYPES, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schedulingRuleSchema.index({ ruleType: 1, isActive: 1 });

export function getSchedulingRuleModel(conn: Connection): Model<SchedulingRuleDoc> {
  return (
    conn.models.SchedulingRule ??
    conn.model<SchedulingRuleDoc>("SchedulingRule", schedulingRuleSchema)
  );
}
