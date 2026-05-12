import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

/** What an employee may request ahead of AI scheduling (not typically "sick"). */
export const ATTENDANCE_PREFERENCE_STATUSES = ["office", "home", "vacation", "off"] as const;
export type AttendancePreferenceStatus = (typeof ATTENDANCE_PREFERENCE_STATUSES)[number];

export interface PreferenceDayEntry {
  workDate: string;
  /** Omit or empty = no preference for that day. */
  preference?: AttendancePreferenceStatus;
}

export interface AttendancePreferenceDoc {
  _id: import("mongoose").Types.ObjectId;
  employeeId: import("mongoose").Types.ObjectId;
  departmentId?: import("mongoose").Types.ObjectId;
  /** UTC Sunday YYYY-MM-DD; same convention as week-grid. */
  weekStartSunday: string;
  days: PreferenceDayEntry[];
  status: "draft" | "submitted";
  /** Throttle preference reminder emails/socket without re-querying all history. */
  lastPreferenceReminderAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dayEntrySchema = new Schema<PreferenceDayEntry>(
  {
    workDate: { type: String, required: true },
    preference: { type: String, enum: ATTENDANCE_PREFERENCE_STATUSES },
  },
  { _id: false }
);

const attendancePreferenceSchema = new Schema<AttendancePreferenceDoc>(
  {
    employeeId: { type: Schema.Types.ObjectId, required: true, ref: "Employee" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    weekStartSunday: { type: String, required: true },
    days: { type: [dayEntrySchema], default: [] },
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    lastPreferenceReminderAt: { type: Date },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

attendancePreferenceSchema.index({ employeeId: 1, weekStartSunday: 1 }, { unique: true });
attendancePreferenceSchema.index({ departmentId: 1, weekStartSunday: 1 });

export function getAttendancePreferenceModel(conn: Connection): Model<AttendancePreferenceDoc> {
  return (
    conn.models.AttendancePreference ??
    conn.model<AttendancePreferenceDoc>("AttendancePreference", attendancePreferenceSchema)
  );
}
