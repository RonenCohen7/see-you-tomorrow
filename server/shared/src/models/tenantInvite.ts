import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export interface TenantInviteDoc {
  _id: import("mongoose").Types.ObjectId;
  token: string;
  tenantSlug: string;
  email: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const tenantInviteSchema = new Schema<TenantInviteDoc>(
  {
    token: { type: String, required: true, unique: true },
    tenantSlug: { type: String, required: true, lowercase: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

tenantInviteSchema.index({ tenantSlug: 1, email: 1 });
tenantInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getTenantInviteModel(conn: Connection): Model<TenantInviteDoc> {
  return conn.models.TenantInvite ?? conn.model<TenantInviteDoc>("TenantInvite", tenantInviteSchema);
}
