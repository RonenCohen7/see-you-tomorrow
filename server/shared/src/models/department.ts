import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export interface DepartmentDoc {
  _id: import("mongoose").Types.ObjectId;
  name: string;
  description?: string;
  imageUrl?: string;
  locationId?: import("mongoose").Types.ObjectId;
  managerId?: import("mongoose").Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<DepartmentDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    managerId: { type: Schema.Types.ObjectId, ref: "Employee" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.index({ locationId: 1 });

export function getDepartmentModel(conn: Connection): Model<DepartmentDoc> {
  return conn.models.Department ?? conn.model<DepartmentDoc>("Department", departmentSchema);
}
