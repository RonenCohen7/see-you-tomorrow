import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export interface LocationDoc {
  _id: import("mongoose").Types.ObjectId;
  name: string;
  city?: string;
  country?: string;
  address?: string;
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<LocationDoc>(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    address: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export function getLocationModel(conn: Connection): Model<LocationDoc> {
  return conn.models.Location ?? conn.model<LocationDoc>("Location", locationSchema);
}
