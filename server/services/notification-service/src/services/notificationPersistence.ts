import mongoose from "mongoose";
import {
  DB_NAMES,
  getConnection,
  getNotificationModel,
  NOTIFICATION_CHANNELS,
  SOCKET_EVENTS,
  logger,
  type NotificationDoc,
  type NotificationType,
} from "@syt/shared";
import * as recipientsSvc from "./recipients.js";
import * as http from "../config/httpClients.js";
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
    scheduleContext: doc.scheduleContext
      ? {
          scheduleId: doc.scheduleContext.scheduleId,
          employeeId: doc.scheduleContext.employeeId,
          employeeName: doc.scheduleContext.employeeName,
          workDate: doc.scheduleContext.workDate,
          workDateEnd: doc.scheduleContext.workDateEnd,
          status: doc.scheduleContext.status,
          ...(doc.scheduleContext.statusDisplayHe
            ? { statusDisplayHe: doc.scheduleContext.statusDisplayHe }
            : {}),
          note: doc.scheduleContext.note,
          updatedBy: doc.scheduleContext.updatedBy,
          updatedByName: doc.scheduleContext.updatedByName,
        }
      : undefined,
    meetingContext: doc.meetingContext
      ? {
          bookingId: doc.meetingContext.bookingId,
          roomId: doc.meetingContext.roomId,
          roomName: doc.meetingContext.roomName,
          locationName: doc.meetingContext.locationName,
          floor: doc.meetingContext.floor,
          workDate: doc.meetingContext.workDate,
          hourStart: doc.meetingContext.hourStart,
          hourEnd: doc.meetingContext.hourEnd,
          title: doc.meetingContext.title,
          organizerId: doc.meetingContext.organizerId,
          organizerName: doc.meetingContext.organizerName,
          isUpdate: doc.meetingContext.isUpdate,
        }
      : undefined,
  };
}

export async function handleScheduleChange(payload: {
  scheduleId: string;
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDate: string;
  status: string;
  statusDisplayHe?: string;
  updatedBy?: string;
  note?: string;
}) {
  const includeAdmins = process.env.INCLUDE_ADMINS_IN_SCHEDULE_NOTIFICATIONS !== "false";
  const recipientIds = await recipientsSvc.resolveScheduleRecipients({
    employeeId: payload.employeeId,
    departmentId: payload.departmentId,
    includeAdmins,
  });

  const [emp, updater] = await Promise.all([
    http.fetchEmployee(payload.employeeId),
    payload.updatedBy ? http.fetchEmployee(payload.updatedBy) : Promise.resolve(null),
  ]);
  const employeeName = emp?.fullName?.trim() || `עובד ${payload.employeeId.slice(-6)}`;
  const updatedByName = updater?.fullName?.trim() || undefined;

  const statusLine = payload.statusDisplayHe?.trim() ?? payload.status;

  const title = "עדכון שיבוץ בלוח זמנים";
  const message = updatedByName
    ? `${employeeName} · ${payload.workDate} · סטטוס ${statusLine} · עודכן על ידי ${updatedByName}`
    : `${employeeName} · ${payload.workDate} · סטטוס ${statusLine}`;

  const scheduleContext = {
    scheduleId: payload.scheduleId,
    employeeId: payload.employeeId,
    employeeName,
    workDate: payload.workDate,
    status: payload.status,
    ...(payload.statusDisplayHe ? { statusDisplayHe: payload.statusDisplayHe } : {}),
    ...(payload.note ? { note: payload.note } : {}),
    ...(payload.updatedBy ? { updatedBy: payload.updatedBy, updatedByName } : {}),
  };

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
    scheduleContext,
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

  emailQueue.enqueueEmailJobsBestEffort(
    recipientIds.map((rid) => ({
      name: `email-${doc._id}-${rid}`,
      data: {
        notificationId: pub.id,
        recipientId: rid,
        workDate: payload.workDate,
        status: statusLine,
      },
      opts: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
      },
    })),
  );

  await Notification.updateOne({ _id: doc._id }, { deliveryStatus: "sent" }).catch(() => {
    logger.warn("notification delivery status update failed");
  });

  return pub;
}

export async function handleScheduleRangeChange(payload: {
  scheduleId: string;
  employeeId: string;
  departmentId?: string;
  locationId?: string;
  workDateFrom: string;
  workDateTo: string;
  dayCount: number;
  status: string;
  statusDisplayHe?: string;
  updatedBy?: string;
  note?: string;
}) {
  const includeAdmins = process.env.INCLUDE_ADMINS_IN_SCHEDULE_NOTIFICATIONS !== "false";
  const recipientIds = await recipientsSvc.resolveScheduleRecipients({
    employeeId: payload.employeeId,
    departmentId: payload.departmentId,
    includeAdmins,
  });

  const [emp, updater] = await Promise.all([
    http.fetchEmployee(payload.employeeId),
    payload.updatedBy ? http.fetchEmployee(payload.updatedBy) : Promise.resolve(null),
  ]);
  const employeeName = emp?.fullName?.trim() || `עובד ${payload.employeeId.slice(-6)}`;
  const updatedByName = updater?.fullName?.trim() || undefined;

  const statusLine = payload.statusDisplayHe?.trim() ?? payload.status;

  const title = "עדכון טווח שיבוץ בלוח זמנים";
  const rangeLabel = `${payload.workDateFrom} – ${payload.workDateTo} (${payload.dayCount} ימים)`;
  const message = updatedByName
    ? `${employeeName} · ${rangeLabel} · סטטוס ${statusLine} · עודכן על ידי ${updatedByName}`
    : `${employeeName} · ${rangeLabel} · סטטוס ${statusLine}`;

  const scheduleContext = {
    scheduleId: payload.scheduleId,
    employeeId: payload.employeeId,
    employeeName,
    workDate: payload.workDateFrom,
    workDateEnd: payload.workDateTo,
    status: payload.status,
    ...(payload.statusDisplayHe ? { statusDisplayHe: payload.statusDisplayHe } : {}),
    ...(payload.note ? { note: payload.note } : {}),
    ...(payload.updatedBy ? { updatedBy: payload.updatedBy, updatedByName } : {}),
  };

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
    scheduleContext,
  });

  const pub = toPublic(doc as NotificationDoc & { _id: mongoose.Types.ObjectId });

  for (const rid of recipientIds) {
    socket.emitToUser(rid, SOCKET_EVENTS.notificationNew, pub);
    socket.emitToUser(rid, SOCKET_EVENTS.scheduleUpdated, {
      scheduleId: payload.scheduleId,
      workDate: payload.workDateFrom,
      status: payload.status,
    });
  }
  socket.emitDashboardRefresh(recipientIds);

  emailQueue.enqueueEmailJobsBestEffort(
    recipientIds.map((rid) => ({
      name: `email-${doc._id}-${rid}`,
      data: {
        notificationId: pub.id,
        recipientId: rid,
        workDate: payload.workDateFrom,
        workDateEnd: payload.workDateTo,
        status: statusLine,
      },
      opts: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
      },
    })),
  );

  await Notification.updateOne({ _id: doc._id }, { deliveryStatus: "sent" }).catch(() => {
    logger.warn("notification delivery status update failed");
  });

  return pub;
}

const PREF_REMINDER_TITLE_PREFIX = "תזכורת: מילוי העדפות שיבוץ";

export async function hasRecentPreferenceReminder(
  userId: string,
  weekStartSunday: string,
  withinMs: number
): Promise<boolean> {
  const Notification = await model();
  const uid = new mongoose.Types.ObjectId(userId);
  const since = new Date(Date.now() - withinMs);
  const doc = await Notification.findOne({
    type: "preference_reminder",
    recipientIds: uid,
    title: `${PREF_REMINDER_TITLE_PREFIX} (${weekStartSunday})`,
    createdAt: { $gte: since },
  })
    .select("_id")
    .lean();
  return !!doc;
}

export async function createPreferenceReminder(userId: string, weekStartSunday: string) {
  const Notification = await model();
  const title = `${PREF_REMINDER_TITLE_PREFIX} (${weekStartSunday})`;
  const message = `נא למלא העדפות נוכחות לשבוע שנפתח ב-${weekStartSunday}. אפשר למלא ממסך «העדפות שיבוץ».`;

  const doc = await Notification.create({
    title,
    message,
    type: "preference_reminder",
    recipientIds: [new mongoose.Types.ObjectId(userId)],
    channels: ["socket", "inapp"],
    deliveryStatus: "pending",
    readBy: [],
    createdAt: new Date(),
  });

  const pub = toPublic(doc as NotificationDoc & { _id: mongoose.Types.ObjectId });
  socket.emitToUser(userId, SOCKET_EVENTS.notificationNew, pub);
  await Notification.updateOne({ _id: doc._id }, { deliveryStatus: "sent" }).catch(() => {
    logger.warn("preference reminder delivery status update failed");
  });
  return pub;
}

export async function handlePreferenceSubmission(payload: {
  employeeId: string;
  departmentId?: string;
  weekStartSunday: string;
}) {
  const recipientIds = await recipientsSvc.resolvePreferenceSubmissionRecipients({
    departmentId: payload.departmentId,
    submitterEmployeeId: payload.employeeId,
    includeAdmins: true,
  });
  if (recipientIds.length === 0) return null;

  const emp = await http.fetchEmployee(payload.employeeId);
  const employeeName = emp?.fullName?.trim() || `עובד ${payload.employeeId.slice(-6)}`;

  const title = "הוגשו העדפות שיבוץ שבועיות";
  const message = `${employeeName} הגיש/ה העדפות נוכחות לשבוע שנפתח ב-${payload.weekStartSunday}. הצגה במסך «העדפות צוות».`;

  const Notification = await model();
  const doc = await Notification.create({
    title,
    message,
    type: "preference_submitted",
    recipientIds: recipientIds.map((id) => new mongoose.Types.ObjectId(id)),
    channels: ["socket", "inapp"],
    deliveryStatus: "pending",
    readBy: [],
    createdAt: new Date(),
  });

  const pub = toPublic(doc as NotificationDoc & { _id: mongoose.Types.ObjectId });

  for (const rid of recipientIds) {
    socket.emitToUser(rid, SOCKET_EVENTS.notificationNew, pub);
  }
  socket.emitDashboardRefresh(recipientIds);

  await Notification.updateOne({ _id: doc._id }, { deliveryStatus: "sent" }).catch(() => {
    logger.warn("preference submission notification delivery status update failed");
  });

  return pub;
}

async function emitPipelineInApp(type: NotificationType, title: string, message: string, recipientIds: string[]) {
  if (recipientIds.length === 0) return null;
  const Notification = await model();
  const doc = await Notification.create({
    title,
    message,
    type,
    recipientIds: recipientIds.map((id) => new mongoose.Types.ObjectId(id)),
    channels: ["socket", "inapp"],
    deliveryStatus: "pending",
    readBy: [],
    createdAt: new Date(),
  });
  const pub = toPublic(doc as NotificationDoc & { _id: mongoose.Types.ObjectId });
  for (const rid of recipientIds) socket.emitToUser(rid, SOCKET_EVENTS.notificationNew, pub);
  socket.emitDashboardRefresh(recipientIds);
  await Notification.updateOne({ _id: doc._id }, { deliveryStatus: "sent" }).catch(() => {
    logger.warn("pipeline notification delivery failed");
  });
  return pub;
}

export async function handlePreferencePipelineQueued(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
}) {
  const message = `העדפות לשבוע ${payload.weekStartSunday} התקבלו ונכנסו לתור להפעלת בדיקת AI (יחול דחיה קצרה אם מתקבלות הגשות נוספות).`;
  return emitPipelineInApp(
    "preference_pipeline_queued",
    "העדפות בתור ל-AI",
    message,
    payload.submitterEmployeeIds
  );
}

export async function handlePreferencePipelineAiReady(payload: {
  departmentId: string;
  weekStartSunday: string;
  batchId: string;
  submitterEmployeeIds: string[];
  summary?: {
    matchedPreference?: number;
    differsFromPreference?: number;
    noSubmittedPreferenceForSlot?: number;
    recommendationRows?: number;
  };
}) {
  const s = payload.summary;
  const hint =
    s && typeof s.matchedPreference === "number"
      ? ` התאמה להעדפות: ${s.matchedPreference} · סטיות: ${s.differsFromPreference ?? "?"} · שורות:${s.recommendationRows ?? "?"}`
      : "";
  const message = `הוכנה הצעת שיבוץ לשבוע ${payload.weekStartSunday}. ממתינה לאישור מנהל לפני פרסום.${hint}`;
  return emitPipelineInApp(
    "preference_pipeline_ai_ready",
    "הצעת AI מוכנה לאישור",
    message,
    payload.submitterEmployeeIds
  );
}

export async function handlePreferencePipelineAiFailed(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
  message: string;
}) {
  const msg = `${payload.message} (שבוע ${payload.weekStartSunday})`;
  return emitPipelineInApp(
    "preference_pipeline_ai_failed",
    "לא ניתן להשלים המלצת AI",
    msg,
    payload.submitterEmployeeIds
  );
}

export async function handlePreferencePipelineValidationManagers(payload: {
  departmentId: string;
  weekStartSunday: string;
  message: string;
}) {
  const recipientIds = await recipientsSvc.resolveDeptManagersAdminsRecipients(payload.departmentId);
  const msg = `ולידציית שיבוץ נכשלה לשבוע ${payload.weekStartSunday}: ${payload.message}`;
  return emitPipelineInApp(
    "preference_pipeline_ai_failed",
    "ולידציית AI למחלקה",
    msg,
    recipientIds
  );
}

export async function handlePreferencePipelineNoLocation(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
}) {
  const mgrs = await recipientsSvc.resolveDeptManagersAdminsRecipients(payload.departmentId);
  const uniq = [...new Set([...payload.submitterEmployeeIds, ...mgrs])];
  const msg = `למחלקה לא שויכה נקודת מיקום — לא ניתן להפעיל המלצת AI אוטומטית לשבוע ${payload.weekStartSunday}.`;
  return emitPipelineInApp("preference_pipeline_no_location", "חסר מיקום למחלקה", msg, uniq);
}

export async function handlePreferencePipelineApplied(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
}) {
  const message = `השיבוץ לשבוע ${payload.weekStartSunday} פורסם ללוח על בסיס ההמלצה שאושרה.`;
  return emitPipelineInApp(
    "preference_pipeline_applied",
    "השיבוץ פורסם",
    message,
    payload.submitterEmployeeIds
  );
}

export async function handlePreferencePipelineRejected(payload: {
  departmentId: string;
  weekStartSunday: string;
  submitterEmployeeIds: string[];
}) {
  const message = `הצעת השיבוץ האוטומטית לשבוע ${payload.weekStartSunday} בוטלה על ידי המנהל — לא תפורסם ללוח.`;
  return emitPipelineInApp(
    "preference_pipeline_rejected",
    "הצעת AI בוטלה",
    message,
    payload.submitterEmployeeIds
  );
}

export async function handlePreferencePipelineBatchPendingManagers(payload: {
  departmentId: string;
  weekStartSunday: string;
  batchId: string;
}) {
  const recipientIds = await recipientsSvc.resolveDeptManagersAdminsRecipients(payload.departmentId);
  const message = `ממתין שיבוץ AI שהופק מהעדפות עובדים לשבוע ${payload.weekStartSunday}. מזהה אצווה: …${payload.batchId.slice(-6)}`;
  return emitPipelineInApp(
    "preference_pipeline_ai_ready",
    "נדרש אישור להצעת שיבוץ",
    message,
    recipientIds
  );
}

export async function handleMeetingInvite(payload: {
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
  inviteeIds: string[];
  isUpdate?: boolean;
}) {
  const recipientIds = [...new Set(payload.inviteeIds)].filter(Boolean);
  if (recipientIds.length === 0) return null;

  const hoursLabel =
    payload.hourStart != null || payload.hourEnd != null
      ? `${payload.hourStart ?? "—"}–${payload.hourEnd ?? "—"}`
      : "יום מלא";

  const title = payload.isUpdate ? "עודכנה הזמנה לישיבה" : "הוזמנת לישיבה";
  const floorPart = payload.floor ? ` · קומה ${payload.floor}` : "";
  const message = `${payload.title} · ${payload.roomName} · ${payload.locationName}${floorPart} · ${payload.workDate} · ${hoursLabel} · מארגן/ת: ${payload.organizerName}`;

  const meetingContext = {
    bookingId: payload.bookingId,
    roomId: payload.roomId,
    roomName: payload.roomName,
    locationName: payload.locationName,
    ...(payload.floor ? { floor: payload.floor } : {}),
    workDate: payload.workDate,
    ...(payload.hourStart !== undefined ? { hourStart: payload.hourStart } : {}),
    ...(payload.hourEnd !== undefined ? { hourEnd: payload.hourEnd } : {}),
    title: payload.title,
    organizerId: payload.organizerId,
    organizerName: payload.organizerName,
    isUpdate: payload.isUpdate ?? false,
  };

  const Notification = await model();
  const doc = await Notification.create({
    title,
    message,
    type: "meeting_invite",
    recipientIds: recipientIds.map((id) => new mongoose.Types.ObjectId(id)),
    channels: Array.from(NOTIFICATION_CHANNELS),
    deliveryStatus: "pending",
    readBy: [],
    createdBy: new mongoose.Types.ObjectId(payload.organizerId),
    createdAt: new Date(),
    meetingContext,
  });

  const pub = toPublic(doc as NotificationDoc & { _id: mongoose.Types.ObjectId });

  for (const rid of recipientIds) {
    socket.emitToUser(rid, SOCKET_EVENTS.notificationNew, pub);
  }
  socket.emitDashboardRefresh(recipientIds);

  emailQueue.enqueueEmailJobsBestEffort(
    recipientIds.map((rid) => ({
      name: `email-meeting-${doc._id}-${rid}`,
      data: {
        notificationKind: "meeting_invite" as const,
        notificationId: pub.id,
        recipientId: rid,
        meetingSubject: title,
        meetingBody: message,
      },
      opts: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
      },
    })),
  );

  await Notification.updateOne({ _id: doc._id }, { deliveryStatus: "sent" }).catch(() => {
    logger.warn("meeting notification delivery status update failed");
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
