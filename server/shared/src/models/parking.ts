import type { Connection, Model, Types } from "mongoose";
import { Schema } from "mongoose";

export interface ParkingSpotDoc {
  _id: Types.ObjectId;
  locationId: Types.ObjectId;
  label: string;
  sortOrder: number;
  assignedEmployeeId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const parkingSpotSchema = new Schema<ParkingSpotDoc>(
  {
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    label: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    assignedEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee", index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

parkingSpotSchema.index({ locationId: 1, sortOrder: 1 });

export function getParkingSpotModel(conn: Connection): Model<ParkingSpotDoc> {
  return conn.models.ParkingSpot ?? conn.model<ParkingSpotDoc>("ParkingSpot", parkingSpotSchema);
}

export interface ParkingReservationDoc {
  _id: Types.ObjectId;
  spotId: Types.ObjectId;
  employeeId: Types.ObjectId;
  workDate: Date;
  hourStart?: number;
  hourEnd?: number;
  note?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const parkingReservationSchema = new Schema<ParkingReservationDoc>(
  {
    spotId: { type: Schema.Types.ObjectId, ref: "ParkingSpot", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    workDate: { type: Date, required: true },
    hourStart: { type: Number, min: 0, max: 24 },
    hourEnd: { type: Number, min: 0, max: 24 },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true }
);

parkingReservationSchema.index({ spotId: 1, workDate: 1 }, { unique: true });

export function getParkingReservationModel(conn: Connection): Model<ParkingReservationDoc> {
  return (
    conn.models.ParkingReservation ??
    conn.model<ParkingReservationDoc>("ParkingReservation", parkingReservationSchema)
  );
}
