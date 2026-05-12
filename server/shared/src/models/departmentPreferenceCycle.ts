import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export const PIPELINE_STATUSES = [
  "queued",
  "ai_running",
  "ai_failed",
  "awaiting_manager",
  "applied",
  "rejected",
  "superseded",
] as const;
export type DepartmentPreferencePipelineStatus = (typeof PIPELINE_STATUSES)[number];

export interface PreferenceCycleSummaryDoc {
  matchedPreference?: number;
  differsFromPreference?: number;
  noSubmittedPreferenceForSlot?: number;
  recommendationRows?: number;
}

export interface DepartmentPreferenceCycleDoc {
  _id: import("mongoose").Types.ObjectId;
  departmentId: import("mongoose").Types.ObjectId;
  weekStartSunday: string;
  pipelineStatus: DepartmentPreferencePipelineStatus;
  aiBatchId?: import("mongoose").Types.ObjectId;
  lastError?: string;
  preferenceSummary?: PreferenceCycleSummaryDoc;
  createdAt: Date;
  updatedAt: Date;
}

const summarySchema = new Schema<PreferenceCycleSummaryDoc>(
  {
    matchedPreference: { type: Number },
    differsFromPreference: { type: Number },
    noSubmittedPreferenceForSlot: { type: Number },
    recommendationRows: { type: Number },
  },
  { _id: false }
);

const departmentPreferenceCycleSchema = new Schema<DepartmentPreferenceCycleDoc>(
  {
    departmentId: { type: Schema.Types.ObjectId, required: true, ref: "Department" },
    weekStartSunday: { type: String, required: true },
    pipelineStatus: {
      type: String,
      enum: PIPELINE_STATUSES,
      default: "queued",
    },
    aiBatchId: { type: Schema.Types.ObjectId, ref: "ScheduleAiBatch" },
    lastError: { type: String },
    preferenceSummary: { type: summarySchema, required: false },
  },
  { timestamps: true }
);

departmentPreferenceCycleSchema.index({ departmentId: 1, weekStartSunday: 1 }, { unique: true });
departmentPreferenceCycleSchema.index({ departmentId: 1, pipelineStatus: 1 });

export function getDepartmentPreferenceCycleModel(conn: Connection): Model<DepartmentPreferenceCycleDoc> {
  return (
    conn.models.DepartmentPreferenceCycle ??
    conn.model<DepartmentPreferenceCycleDoc>("DepartmentPreferenceCycle", departmentPreferenceCycleSchema)
  );
}
