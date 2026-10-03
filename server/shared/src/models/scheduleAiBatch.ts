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

/** Why a preference-pipeline batch was held for a manager instead of being applied automatically. */
export type ScheduleAiBatchExceptionKind = "preference_overridden" | "office_shortfall" | "office_over_capacity";

export interface ScheduleAiBatchException {
  kind: ScheduleAiBatchExceptionKind;
  date?: string;
  employeeId?: string;
  requestedStatus?: string;
  assignedStatus?: string;
  officeCount?: number;
  required?: number;
  capacity?: number;
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
  exceptions?: ScheduleAiBatchException[];
  autoApproved?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const exceptionSchema = new Schema<ScheduleAiBatchException>(
  {
    kind: {
      type: String,
      required: true,
      enum: ["preference_overridden", "office_shortfall", "office_over_capacity"],
    },
    date: { type: String },
    employeeId: { type: String },
    requestedStatus: { type: String },
    assignedStatus: { type: String },
    officeCount: { type: Number },
    required: { type: Number },
    capacity: { type: Number },
  },
  { _id: false }
);

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
    exceptions: { type: [exceptionSchema], default: undefined },
    autoApproved: { type: Boolean },
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
