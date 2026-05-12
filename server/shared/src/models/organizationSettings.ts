import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export interface OrganizationSettingsDoc {
  _id: import("mongoose").Types.ObjectId;
  managerCanEditSchedules: boolean;
  /** Earliest attendance-preference target week starts at least this many UTC days ahead of "today". */
  preferenceMinDaysAhead: number;
  /** Periodic reminder to submit weekly preferences (Socket + in-app notification). */
  preferenceRemindersEnabled: boolean;
  updatedAt: Date;
}

const organizationSettingsSchema = new Schema<OrganizationSettingsDoc>(
  {
    managerCanEditSchedules: { type: Boolean, default: false },
    preferenceMinDaysAhead: { type: Number, default: 7, min: 0, max: 60 },
    preferenceRemindersEnabled: { type: Boolean, default: true },
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
