import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

/** User-defined attendance labels selectable alongside built-in schedule statuses (Hebrew-first). */
export interface CustomScheduleStatusDef {
  id: string;
  labelHe: string;
  labelEn?: string;
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
          },
          { _id: false }
        ),
      ],
      default: [],
    },
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
