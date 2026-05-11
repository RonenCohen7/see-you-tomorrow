import mongoose from "mongoose";
import {
  DB_NAMES,
  getConnection,
  getNotificationModel,
  NOTIFICATION_CHANNELS,
  SOCKET_EVENTS,
  logger,
  type NotificationDoc,
} from "@syt/shared";
import * as recipientsSvc from "./recipients.js";
import * as emailQueue from "./emailQueue.js";
import * as socket from "../socket.js";

async function model() {
  const conn = await getConnection(DB_NAMES.notifications);
  return getNotificationModel(conn);
}

export function toPublic(doc: NotificationDoc & { _id: mongoose.Types.ObjectId }) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    message: doc.message,
    type: doc.type,
    recipientIds: doc.recipientIds.map((id) => id.toString()),
    channels: doc.channels,
    deliveryStatus: doc.deliveryStatus,
    readBy: doc.readBy.map((r) => ({ userId: r.userId.toString(), readAt: r.readAt })),
    createdBy: doc.createdBy?.toString(),
    createdAt: doc.createdAt,
  };
}

export async function handleScheduleChange(payload: {
  scheduleId: string;
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDate: string;
  status: string;
  updatedBy?: string;
  note?: string;
}) {
  const includeAdmins = process.env.INCLUDE_ADMINS_IN_SCHEDULE_NOTIFICATIONS !== "false";
  const recipientIds = await recipientsSvc.resolveScheduleRecipients({
    employeeId: payload.employeeId,
    departmentId: payload.departmentId,
    includeAdmins,
  });

  const title = "עדכון לוח זמנים";
  const message = `תאריך ${payload.workDate} · סטטוס ${payload.status}`;

  const Notification = await model();
  const doc = await Notification.create({
    title,
    message,
    type: "schedule_update",
    recipientIds: recipientIds.map((id) => new mongoose.Types.ObjectId(id)),
    channels: Array.from(NOTIFICATION_CHANNELS),
    deliveryStatus: "pending",
    readBy: [],
    ...(payload.updatedBy
      ? { createdBy: new mongoose.Types.ObjectId(payload.updatedBy) }
      : {}),
    createdAt: new Date(),
  });

  const pub = toPublic(doc as NotificationDoc & { _id: mongoose.Types.ObjectId });

  for (const rid of recipientIds) {
    socket.emitToUser(rid, SOCKET_EVENTS.notificationNew, pub);
    socket.emitToUser(rid, SOCKET_EVENTS.scheduleUpdated, {
      scheduleId: payload.scheduleId,
      workDate: payload.workDate,
      status: payload.status,
    });
  }
  socket.emitDashboardRefresh(recipientIds);

  const q = emailQueue.getEmailQueue();
  for (const rid of recipientIds) {
    await q.add(
      `email-${doc._id}-${rid}`,
      {
        notificationId: pub.id,
        recipientId: rid,
        workDate: payload.workDate,
        status: payload.status,
      },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
      }
    );
  }

  await Notification.updateOne({ _id: doc._id }, { deliveryStatus: "sent" }).catch(() => {
    logger.warn("notification delivery status update failed");
  });

  return pub;
}

export async function listForUser(userId: string, page: number, limit: number) {
  const Notification = await model();
  const skip = (page - 1) * limit;
  const uid = new mongoose.Types.ObjectId(userId);
  const docs = await Notification.find({ recipientIds: uid })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Notification.countDocuments({ recipientIds: uid });
  return {
    items: docs.map((d) => toPublic(d as unknown as NotificationDoc & { _id: mongoose.Types.ObjectId })),
    total,
    page,
    limit,
  };
}

export async function unreadCount(userId: string) {
  const Notification = await model();
  const uid = new mongoose.Types.ObjectId(userId);
  return Notification.countDocuments({
    recipientIds: uid,
    readBy: { $not: { $elemMatch: { userId: uid } } },
  });
}

export async function markRead(notificationId: string, userId: string) {
  const Notification = await model();
  const doc = await Notification.findById(notificationId);
  if (!doc) return null;
  const uid = new mongoose.Types.ObjectId(userId);
  if (!doc.recipientIds.some((id) => id.toString() === userId)) return null;

  const already = doc.readBy.some((r) => r.userId.toString() === userId);
  if (!already) {
    doc.readBy.push({ userId: uid, readAt: new Date() });
    await doc.save();
  }
  return toPublic(doc as NotificationDoc & { _id: mongoose.Types.ObjectId });
}
