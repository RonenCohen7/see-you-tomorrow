import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export type TenantStatus = "active" | "suspended";

export interface TenantRegistryDoc {
  _id: import("mongoose").Types.ObjectId;
  slug: string;
  name: string;
  dbPrefix: string;
  emailDomains: string[];
  subdomain: string;
  authServiceUrl: string;
  gatewayUrl: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

const tenantRegistrySchema = new Schema<TenantRegistryDoc>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    dbPrefix: { type: String, required: true, trim: true },
    emailDomains: { type: [String], default: [] },
    subdomain: { type: String, required: true, lowercase: true, trim: true },
    authServiceUrl: { type: String, required: true, trim: true },
    gatewayUrl: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
  },
  { timestamps: true }
);

tenantRegistrySchema.index({ emailDomains: 1 });
tenantRegistrySchema.index({ status: 1 });

export function getTenantRegistryModel(conn: Connection): Model<TenantRegistryDoc> {
  return (
    conn.models.TenantRegistry ??
    conn.model<TenantRegistryDoc>("TenantRegistry", tenantRegistrySchema)
  );
}
