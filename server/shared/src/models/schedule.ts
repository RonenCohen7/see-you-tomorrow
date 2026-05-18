import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export const SCHEDULE_STATUSES = ["office", "home", "vacation", "sick", "off"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

/** Stored value for organization-defined statuses: `custom:` + hex id from OrganizationSettings.customScheduleStatuses. */
export const CUSTOM_SCHEDULE_STATUS_PREFIX = "custom:" as const;

const CUSTOM_STATUS_REF_RE = /^custom:[a-f0-9]{8,48}$/i;

export function isBuiltinScheduleStatus(s: string): s is ScheduleStatus {
  return (SCHEDULE_STATUSES as readonly string[]).includes(s);
}

export function isValidStoredScheduleStatus(s: string): boolean {
  return isBuiltinScheduleStatus(s) || CUSTOM_STATUS_REF_RE.test(s);
}

export function customScheduleStoredValue(idHex: string): string {
  return `${CUSTOM_SCHEDULE_STATUS_PREFIX}${idHex}`;
}

/** How the row was authored (UI / manual vs approved AI batch). */
export const SCHEDULE_SOURCES = ["manual", "ai"] as const;
export type ScheduleSource = (typeof SCHEDULE_SOURCES)[number];

export interface ScheduleDoc {
  _id: import("mongoose").Types.ObjectId;
  employeeId: import("mongoose").Types.ObjectId;
  departmentId?: import("mongoose").Types.ObjectId;
  locationId?: import("mongoose").Types.ObjectId;
  workDate: Date;
  /** Built-in `ScheduleStatus` or `custom:<hexId>` registered on the organization. */
  status: string;
  hours?: number;
  note?: string;
  updatedBy?: import("mongoose").Types.ObjectId;
  source: ScheduleSource;
  aiBatchId?: import("mongoose").Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleSchema = new Schema<ScheduleDoc>(
  {
    employeeId: { type: Schema.Types.ObjectId, required: true, ref: "Employee" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    workDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => isValidStoredScheduleStatus(v),
        message: "Invalid schedule status",
      },
    },
    /**
     * Optional segment length (0..24). When omitted, the entry represents a full day.
     * Multiple entries may exist for the same employee on the same workDate to support
     * split schedules (e.g. 4h office + 4h home).
     */
    hours: { type: Number, min: 0, max: 24 },
    note: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Employee" },
    source: { type: String, enum: SCHEDULE_SOURCES, default: "manual" },
    aiBatchId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);

// Non-unique compound index for fast (employee, day) lookups
scheduleSchema.index({ employeeId: 1, workDate: 1 });
scheduleSchema.index({ workDate: 1, departmentId: 1 });
scheduleSchema.index({ workDate: 1, locationId: 1 });

export function getScheduleModel(conn: Connection): Model<ScheduleDoc> {
  return conn.models.Schedule ?? conn.model<ScheduleDoc>("Schedule", scheduleSchema);
}
