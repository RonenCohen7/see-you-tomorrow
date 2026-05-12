import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";
import type { ScheduleStatus } from "./schedule.js";

export type ScheduleAiBatchCreationSource = "manual" | "preference_pipeline";

export type ScheduleAiBatchStatus =
  | "draft"
  | "pending_manager"
  | "approved"
  | "rejected"
  | "superseded";

export interface ScheduleAiBatchItem {
  date: string;
  employeeId: string;
  recommendedStatus: ScheduleStatus;
  reason?: string;
}

export interface ScheduleAiBatchDoc {
  _id: import("mongoose").Types.ObjectId;
  departmentId: import("mongoose").Types.ObjectId;
  locationId?: import("mongoose").Types.ObjectId;
  dateRange: { from: string; to: string };
  proposedItems: ScheduleAiBatchItem[];
  status: ScheduleAiBatchStatus;
  creationSource?: ScheduleAiBatchCreationSource;
  preferenceCycleId?: import("mongoose").Types.ObjectId;
  createdBy: import("mongoose").Types.ObjectId;
  approvedBy?: import("mongoose").Types.ObjectId;
  confidence?: number;
  model?: string;
  validationNotes?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ScheduleAiBatchItem>(
  {
    date: { type: String, required: true },
    employeeId: { type: String, required: true },
    recommendedStatus: { type: String, required: true },
    reason: { type: String },
  },
  { _id: false }
);

const scheduleAiBatchSchema = new Schema<ScheduleAiBatchDoc>(
  {
    departmentId: { type: Schema.Types.ObjectId, required: true, ref: "Department" },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    dateRange: {
      from: { type: String, required: true },
      to: { type: String, required: true },
    },
    proposedItems: { type: [itemSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "pending_manager", "approved", "rejected", "superseded"],
      default: "pending_manager",
    },
    creationSource: { type: String, enum: ["manual", "preference_pipeline"] },
    preferenceCycleId: { type: Schema.Types.ObjectId },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "Employee" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Employee" },
    confidence: { type: Number },
    model: { type: String },
    validationNotes: [{ type: String }],
  },
  { timestamps: true }
);

scheduleAiBatchSchema.index({ departmentId: 1, status: 1, createdAt: -1 });
scheduleAiBatchSchema.index({ departmentId: 1, creationSource: 1, status: 1 });
scheduleAiBatchSchema.index({ preferenceCycleId: 1 });

export function getScheduleAiBatchModel(conn: Connection): Model<ScheduleAiBatchDoc> {
  return (
    conn.models.ScheduleAiBatch ??
    conn.model<ScheduleAiBatchDoc>("ScheduleAiBatch", scheduleAiBatchSchema)
  );
}
