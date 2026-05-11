import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export interface OrganizationSettingsDoc {
  _id: import("mongoose").Types.ObjectId;
  managerCanEditSchedules: boolean;
  updatedAt: Date;
}

const organizationSettingsSchema = new Schema<OrganizationSettingsDoc>(
  {
    managerCanEditSchedules: { type: Boolean, default: false },
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
