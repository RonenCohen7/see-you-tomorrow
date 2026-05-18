import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

import type { ScheduleStatus } from "./schedule.js";

/** User-defined attendance labels selectable alongside built-in schedule statuses (Hebrew-first). */
export interface CustomScheduleStatusDef {
  id: string;
  labelHe: string;
  labelEn?: string;
  /** When true, existing rows keep the value but the status is hidden from pickers and reports. Default: active */
  disabled?: boolean;
}

export interface OrganizationSettingsDoc {
  _id: import("mongoose").Types.ObjectId;
  managerCanEditSchedules: boolean;
  /** Earliest attendance-preference target week starts at least this many UTC days ahead of "today". */
  preferenceMinDaysAhead: number;
  /** Periodic reminder to submit weekly preferences (Socket + in-app notification). */
  preferenceRemindersEnabled: boolean;
  /** Extra schedule status options (shown in schedule UI beside office/home/vacation/sick/off). */
  customScheduleStatuses?: CustomScheduleStatusDef[];
  /** Built-in schedule keys hidden from assignment pickers and reports (subset of SCHEDULE_STATUSES). */
  disabledBuiltinScheduleStatuses?: ScheduleStatus[];
  updatedAt: Date;
}

const organizationSettingsSchema = new Schema<OrganizationSettingsDoc>(
  {
    managerCanEditSchedules: { type: Boolean, default: false },
    preferenceMinDaysAhead: { type: Number, default: 7, min: 0, max: 60 },
    preferenceRemindersEnabled: { type: Boolean, default: true },
    customScheduleStatuses: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            labelHe: { type: String, required: true },
            labelEn: { type: String },
            disabled: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    disabledBuiltinScheduleStatuses: { type: [String], default: [] },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

export function getOrganizationSettingsModel(conn: Connection): Model<OrganizationSettingsDoc> {
  return (
    conn.models.OrganizationSettings ??
    conn.model<OrganizationSettingsDoc>("OrganizationSettings", organizationSettingsSchema)
  );
}
