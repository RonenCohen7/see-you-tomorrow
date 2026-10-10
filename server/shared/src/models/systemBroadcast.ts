import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export const SYSTEM_BROADCAST_SEVERITIES = ["info", "warning", "error"] as const;
export type SystemBroadcastSeverity = (typeof SYSTEM_BROADCAST_SEVERITIES)[number];

export interface SystemBroadcastDoc {
  _id: import("mongoose").Types.ObjectId;
  title: string;
  message: string;
  severity: SystemBroadcastSeverity;
  createdBy?: import("mongoose").Types.ObjectId;
  dismissedBy: import("mongoose").Types.ObjectId[];
  createdAt: Date;
}

const systemBroadcastSchema = new Schema<SystemBroadcastDoc>(
  {
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 2000 },
    severity: { type: String, enum: SYSTEM_BROADCAST_SEVERITIES, default: "info" },
    createdBy: { type: Schema.Types.ObjectId },
    dismissedBy: [{ type: Schema.Types.ObjectId }],
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

systemBroadcastSchema.index({ createdAt: -1 });

export function getSystemBroadcastModel(conn: Connection): Model<SystemBroadcastDoc> {
  return conn.models.SystemBroadcast ?? conn.model<SystemBroadcastDoc>("SystemBroadcast", systemBroadcastSchema);
}
