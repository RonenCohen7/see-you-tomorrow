import type { Connection, Model, Types } from "mongoose";
import { Schema } from "mongoose";

export type MeetingMaterialKind = "link" | "file";

export interface MeetingMaterialDoc {
  kind: MeetingMaterialKind;
  /** link */
  url?: string;
  label?: string;
  /** file */
  fileName?: string;
  mimeType?: string;
  /** data URL or raw base64 payload — size enforced in API layer */
  dataUrl?: string;
}

export interface MeetingRoomDoc {
  _id: Types.ObjectId;
  locationId: Types.ObjectId;
  name: string;
  floor: string;
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const meetingRoomSchema = new Schema<MeetingRoomDoc>(
  {
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    name: { type: String, required: true, trim: true },
    floor: { type: String, required: true, trim: true, default: "" },
    capacity: { type: Number, required: true, min: 1, max: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

meetingRoomSchema.index({ locationId: 1, name: 1 });

export function getMeetingRoomModel(conn: Connection): Model<MeetingRoomDoc> {
  return conn.models.MeetingRoom ?? conn.model<MeetingRoomDoc>("MeetingRoom", meetingRoomSchema);
}

const materialSchema = new Schema<MeetingMaterialDoc>(
  {
    kind: { type: String, enum: ["link", "file"], required: true },
    url: { type: String, trim: true },
    label: { type: String, trim: true },
    fileName: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    dataUrl: { type: String },
  },
  { _id: false }
);

export interface MeetingBookingDoc {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  organizerId: Types.ObjectId;
  workDate: Date;
  hourStart?: number;
  hourEnd?: number;
  title: string;
  inviteeIds: Types.ObjectId[];
  materials: MeetingMaterialDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const meetingBookingSchema = new Schema<MeetingBookingDoc>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "MeetingRoom", required: true, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    workDate: { type: Date, required: true, index: true },
    hourStart: { type: Number, min: 0, max: 24 },
    hourEnd: { type: Number, min: 0, max: 24 },
    title: { type: String, required: true, trim: true, maxlength: 500 },
    inviteeIds: [{ type: Schema.Types.ObjectId, ref: "Employee" }],
    materials: [materialSchema],
  },
  { timestamps: true }
);

meetingBookingSchema.index({ roomId: 1, workDate: 1 });

export function getMeetingBookingModel(conn: Connection): Model<MeetingBookingDoc> {
  return (
    conn.models.MeetingBooking ??
    conn.model<MeetingBookingDoc>("MeetingBooking", meetingBookingSchema)
  );
}
