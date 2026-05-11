import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";
import type { Role } from "../types/roles.js";

export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "partner"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export interface EmployeeDoc {
  _id: import("mongoose").Types.ObjectId;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  imageUrl?: string;
  jobTitle?: string;
  departmentId?: import("mongoose").Types.ObjectId;
  locationId?: import("mongoose").Types.ObjectId;
  managerId?: import("mongoose").Types.ObjectId;
  role: Role;
  isActive: boolean;
  birthDate?: Date;
  address?: string;
  maritalStatus?: MaritalStatus;
  emergencyContact?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<EmployeeDoc>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    imageUrl: { type: String },
    jobTitle: { type: String, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    managerId: { type: Schema.Types.ObjectId, ref: "Employee" },
    role: {
      type: String,
      enum: ["admin", "manager", "employee"],
      required: true,
      default: "employee",
    },
    isActive: { type: Boolean, default: true },
    birthDate: { type: Date },
    address: { type: String, trim: true },
    maritalStatus: { type: String, enum: MARITAL_STATUSES },
    emergencyContact: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

employeeSchema.index({ departmentId: 1, locationId: 1 });
employeeSchema.index({ fullName: "text", email: "text" });

export function getEmployeeModel(conn: Connection): Model<EmployeeDoc> {
  return conn.models.Employee ?? conn.model<EmployeeDoc>("Employee", employeeSchema);
}
