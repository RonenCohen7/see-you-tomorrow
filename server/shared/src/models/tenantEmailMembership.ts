import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export interface TenantEmailMembershipDoc {
  _id: import("mongoose").Types.ObjectId;
  email: string;
  tenantSlug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tenantEmailMembershipSchema = new Schema<TenantEmailMembershipDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    tenantSlug: { type: String, required: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

tenantEmailMembershipSchema.index({ email: 1, tenantSlug: 1 }, { unique: true });
tenantEmailMembershipSchema.index({ email: 1, isActive: 1 });
tenantEmailMembershipSchema.index({ tenantSlug: 1, email: 1 });

export function getTenantEmailMembershipModel(conn: Connection): Model<TenantEmailMembershipDoc> {
  return (
    conn.models.TenantEmailMembership ??
    conn.model<TenantEmailMembershipDoc>("TenantEmailMembership", tenantEmailMembershipSchema)
  );
}
