import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export const NOTIFICATION_TYPES = [
  "schedule_update",
  "department_update",
  "location_update",
  "preference_reminder",
  "preference_submitted",
  "preference_pipeline_queued",
  "preference_pipeline_ai_ready",
  "preference_pipeline_ai_failed",
  "preference_pipeline_applied",
  "preference_pipeline_rejected",
  "preference_pipeline_no_location",
  "meeting_invite",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["email", "socket", "inapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface ReadByEntry {
  userId: import("mongoose").Types.ObjectId;
  readAt: Date;
}

export interface ScheduleNotificationContext {
  scheduleId: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  /** When set and different from workDate, the update spans multiple days (inclusive). */
  workDateEnd?: string;
  status: string;
  note?: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface MeetingNotificationContext {
  bookingId: string;
  roomId: string;
  roomName: string;
  locationName: string;
  floor?: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
  title: string;
  organizerId: string;
  organizerName: string;
  /** True when booking was updated (invitee notification refresh). */
  isUpdate?: boolean;
}

export interface NotificationDoc {
  _id: import("mongoose").Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  recipientIds: import("mongoose").Types.ObjectId[];
  channels: NotificationChannel[];
  deliveryStatus: DeliveryStatus;
  readBy: ReadByEntry[];
  createdBy?: import("mongoose").Types.ObjectId;
  createdAt: Date;
  /** Populated for schedule_update — richer UI without extra round-trips. */
  scheduleContext?: ScheduleNotificationContext;
  meetingContext?: MeetingNotificationContext;
}

const readBySchema = new Schema<ReadByEntry>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false }
);

const scheduleContextSchema = new Schema(
  {
    scheduleId: { type: String },
    employeeId: { type: String },
    employeeName: { type: String },
    workDate: { type: String },
    workDateEnd: { type: String },
    status: { type: String },
    note: { type: String },
    updatedBy: { type: String },
    updatedByName: { type: String },
  },
  { _id: false }
);

const meetingContextSchema = new Schema(
  {
    bookingId: { type: String },
    roomId: { type: String },
    roomName: { type: String },
    locationName: { type: String },
    floor: { type: String },
    workDate: { type: String },
    hourStart: { type: Number },
    hourEnd: { type: Number },
    title: { type: String },
    organizerId: { type: String },
    organizerName: { type: String },
    isUpdate: { type: Boolean },
  },
  { _id: false }
);

const notificationSchema = new Schema<NotificationDoc>(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    recipientIds: [{ type: Schema.Types.ObjectId }],
    channels: [{ type: String, enum: NOTIFICATION_CHANNELS }],
    deliveryStatus: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: "pending",
    },
    readBy: [readBySchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "Employee" },
    createdAt: { type: Date, default: () => new Date() },
    scheduleContext: { type: scheduleContextSchema, required: false },
    meetingContext: { type: meetingContextSchema, required: false },
  },
  { timestamps: false }
);

notificationSchema.index({ recipientIds: 1, createdAt: -1 });

export function getNotificationModel(conn: Connection): Model<NotificationDoc> {
  return conn.models.Notification ?? conn.model<NotificationDoc>("Notification", notificationSchema);
}
