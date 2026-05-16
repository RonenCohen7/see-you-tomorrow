import mongoose from "mongoose";
import {
  AppError,
  DB_NAMES,
  getConnection,
  getLocationModel,
  getMeetingBookingModel,
  getMeetingRoomModel,
  type LocationDoc,
  type MeetingBookingDoc,
  type MeetingMaterialDoc,
  type MeetingRoomDoc,
} from "@syt/shared";
import * as internalHttp from "./internalHttp.js";
import { utcDay } from "./parkingDate.js";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Half-open interval [start, end) in hours within the same calendar day */
export function normalizedHalfOpenInterval(
  hourStart?: number | null,
  hourEnd?: number | null
): [number, number] {
  const whole =
    (hourStart === undefined || hourStart === null) && (hourEnd === undefined || hourEnd === null);
  if (whole) return [0, 24];
  const s = hourStart ?? 0;
  const e = hourEnd ?? 24;
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  return [lo, hi <= lo ? lo + 1e-6 : hi];
}

export function intervalsOverlapHalfOpen(a: [number, number], b: [number, number]): boolean {
  return Math.max(a[0], b[0]) < Math.min(a[1], b[1]);
}

export const MEETING_MATERIAL_MAX_ITEMS = 20;
export const MEETING_DATA_URL_MAX_CHARS = 2_500_000;

async function bookingModel() {
  const conn = await getConnection(DB_NAMES.locations);
  return getMeetingBookingModel(conn);
}

async function roomModel() {
  const conn = await getConnection(DB_NAMES.locations);
  return getMeetingRoomModel(conn);
}

async function locModel() {
  const conn = await getConnection(DB_NAMES.locations);
  return getLocationModel(conn);
}

export type MeetingInviteePublic = { id: string; fullName: string };

export type MeetingBookingPublic = {
  id: string;
  roomId: string;
  roomName: string;
  locationName: string;
  floor: string;
  organizerId: string;
  organizerName: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
  title: string;
  inviteeIds: string[];
  invitees: MeetingInviteePublic[];
  materials: MeetingMaterialDoc[];
};

function validateMaterials(materials: MeetingMaterialDoc[]) {
  if (materials.length > MEETING_MATERIAL_MAX_ITEMS) {
    throw new AppError(400, "יותר מדי קבצים או קישורים", "VALIDATION");
  }
  for (const m of materials) {
    if (m.kind === "link") {
      const url = m.url?.trim() ?? "";
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new AppError(400, "קישור לא תקין", "VALIDATION");
      }
      if (url.length > 2000) throw new AppError(400, "קישור ארוך מדי", "VALIDATION");
    } else if (m.kind === "file") {
      const du = m.dataUrl ?? "";
      if (!du || du.length > MEETING_DATA_URL_MAX_CHARS) {
        throw new AppError(400, "קובץ גדול מדי או חסר", "VALIDATION");
      }
      if (!m.fileName?.trim()) throw new AppError(400, "חסר שם קובץ", "VALIDATION");
    }
  }
}

async function resolveInvitees(ids: mongoose.Types.ObjectId[]): Promise<MeetingInviteePublic[]> {
  const out: MeetingInviteePublic[] = [];
  for (const id of ids) {
    const sid = id.toString();
    const e = await internalHttp.fetchEmployeeInternal(sid);
    out.push({ id: sid, fullName: e?.fullName?.trim() || sid.slice(-6) });
  }
  return out;
}

async function assertSlotAvailable(
  roomId: string,
  workDateIso: string,
  hourStart?: number,
  hourEnd?: number,
  excludeBookingId?: string
) {
  const Booking = await bookingModel();
  const wd = utcDay(workDateIso);
  const existing = await Booking.find({ roomId, workDate: wd }).lean();
  const iv = normalizedHalfOpenInterval(hourStart, hourEnd);
  for (const row of existing) {
    const rid = row._id.toString();
    if (excludeBookingId && rid === excludeBookingId) continue;
    const other = normalizedHalfOpenInterval(row.hourStart, row.hourEnd);
    if (intervalsOverlapHalfOpen(iv, other)) {
      throw new AppError(409, "חדר תפוס בטווח השעות שנבחר", "ROOM_BUSY");
    }
  }
}

async function toBookingPublic(doc: MeetingBookingDoc): Promise<MeetingBookingPublic> {
  const MeetingRoom = await roomModel();
  const Location = await locModel();
  const room = await MeetingRoom.findById(doc.roomId).lean();
  if (!room) {
    throw new AppError(500, "חדר חסר", "INTERNAL");
  }
  const r = room as unknown as MeetingRoomDoc;
  const loc = await Location.findById(r.locationId).lean();
  const locationName = loc ? (loc as unknown as LocationDoc).name : "";
  const org = await internalHttp.fetchEmployeeInternal(doc.organizerId.toString());
  const organizerName = org?.fullName?.trim() || doc.organizerId.toString().slice(-6);
  const wd = doc.workDate instanceof Date ? doc.workDate : new Date(doc.workDate);
  const invitees = await resolveInvitees(doc.inviteeIds ?? []);
  return {
    id: doc._id.toString(),
    roomId: doc.roomId.toString(),
    roomName: r.name,
    locationName,
    floor: r.floor ?? "",
    organizerId: doc.organizerId.toString(),
    organizerName,
    workDate: iso(wd),
    hourStart: doc.hourStart,
    hourEnd: doc.hourEnd,
    title: doc.title,
    inviteeIds: (doc.inviteeIds ?? []).map((id) => id.toString()),
    invitees,
    materials: doc.materials ?? [],
  };
}

export async function listBookings(fromIso: string, toIso: string): Promise<MeetingBookingPublic[]> {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRe.test(fromIso) || !isoRe.test(toIso)) {
    throw new AppError(400, "תאריכים לא תקינים", "VALIDATION");
  }
  const from = utcDay(fromIso);
  const to = utcDay(toIso);
  if (from.getTime() > to.getTime()) throw new AppError(400, "טווח לא תקין", "VALIDATION");
  const Booking = await bookingModel();
  const docs = await Booking.find({
    workDate: { $gte: from, $lte: to },
  })
    .sort({ workDate: 1, roomId: 1 })
    .lean();
  const out: MeetingBookingPublic[] = [];
  for (const d of docs) {
    out.push(await toBookingPublic(d as unknown as MeetingBookingDoc));
  }
  return out;
}

export async function createBooking(input: {
  roomId: string;
  organizerId: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
  title: string;
  inviteeIds: string[];
  materials: MeetingMaterialDoc[];
}) {
  validateMaterials(input.materials);
  const MeetingRoom = await roomModel();
  const room = await MeetingRoom.findById(input.roomId);
  if (!room || !room.isActive) throw new AppError(404, "חדר לא זמין", "NOT_FOUND");

  const headcount = 1 + input.inviteeIds.length;
  if (headcount > room.capacity) {
    throw new AppError(400, "מספר המוזמנים חורג מקיבולת החדר", "CAPACITY");
  }

  await assertSlotAvailable(input.roomId, input.workDate, input.hourStart, input.hourEnd);

  const Booking = await bookingModel();
  const doc = await Booking.create({
    roomId: room._id,
    organizerId: new mongoose.Types.ObjectId(input.organizerId),
    workDate: utcDay(input.workDate),
    hourStart: input.hourStart,
    hourEnd: input.hourEnd,
    title: input.title.trim(),
    inviteeIds: input.inviteeIds.map((id) => new mongoose.Types.ObjectId(id)),
    materials: input.materials,
  });

  const pub = await toBookingPublic(doc as unknown as MeetingBookingDoc);
  await internalHttp.notifyMeetingInvite(pub, input.organizerId, false).catch(() => undefined);
  return pub;
}

export async function updateBooking(
  bookingId: string,
  actorUserId: string,
  actorRole: string,
  input: Partial<{
    roomId: string;
    workDate: string;
    hourStart: number | null;
    hourEnd: number | null;
    title: string;
    inviteeIds: string[];
    materials: MeetingMaterialDoc[];
  }>
) {
  const Booking = await bookingModel();
  const doc = await Booking.findById(bookingId);
  if (!doc) throw new AppError(404, "הזמנה לא נמצאה", "NOT_FOUND");

  const isAdmin = actorRole === "admin";
  if (!isAdmin && doc.organizerId.toString() !== actorUserId) {
    throw new AppError(403, "אין הרשאה", "FORBIDDEN");
  }

  let roomId = doc.roomId.toString();
  let workDateIso = iso(doc.workDate instanceof Date ? doc.workDate : new Date(doc.workDate));
  let hourStart = doc.hourStart;
  let hourEnd = doc.hourEnd;

  if (input.roomId !== undefined) roomId = input.roomId;
  if (input.workDate !== undefined) workDateIso = input.workDate;
  if (input.hourStart !== undefined) hourStart = input.hourStart === null ? undefined : input.hourStart;
  if (input.hourEnd !== undefined) hourEnd = input.hourEnd === null ? undefined : input.hourEnd;

  const MeetingRoom = await roomModel();
  const room = await MeetingRoom.findById(roomId);
  if (!room || !room.isActive) throw new AppError(404, "חדר לא זמין", "NOT_FOUND");

  const inviteeIds =
    input.inviteeIds !== undefined
      ? input.inviteeIds.map((id) => new mongoose.Types.ObjectId(id))
      : doc.inviteeIds;

  const organizerIdStr = doc.organizerId.toString();
  const headcount = 1 + inviteeIds.length;
  if (headcount > room.capacity) {
    throw new AppError(400, "מספר המוזמנים חורג מקיבולת החדר", "CAPACITY");
  }

  const materials = input.materials !== undefined ? input.materials : doc.materials ?? [];
  validateMaterials(materials);

  await assertSlotAvailable(roomId, workDateIso, hourStart, hourEnd, bookingId);

  doc.roomId = room._id;
  doc.workDate = utcDay(workDateIso);
  doc.hourStart = hourStart;
  doc.hourEnd = hourEnd;
  if (input.title !== undefined) doc.title = input.title.trim();
  doc.inviteeIds = inviteeIds;
  doc.materials = materials;
  await doc.save();

  const pub = await toBookingPublic(doc as unknown as MeetingBookingDoc);
  await internalHttp.notifyMeetingInvite(pub, organizerIdStr, true).catch(() => undefined);
  return pub;
}

export async function deleteBooking(bookingId: string, actorUserId: string, actorRole: string) {
  const Booking = await bookingModel();
  const doc = await Booking.findById(bookingId);
  if (!doc) throw new AppError(404, "הזמנה לא נמצאה", "NOT_FOUND");
  const isAdmin = actorRole === "admin";
  if (!isAdmin && doc.organizerId.toString() !== actorUserId) {
    throw new AppError(403, "אין הרשאה", "FORBIDDEN");
  }
  await Booking.deleteOne({ _id: doc._id });
  return { ok: true };
}

export async function getBooking(bookingId: string): Promise<MeetingBookingPublic> {
  const Booking = await bookingModel();
  const doc = await Booking.findById(bookingId).lean();
  if (!doc) throw new AppError(404, "הזמנה לא נמצאה", "NOT_FOUND");
  return toBookingPublic(doc as unknown as MeetingBookingDoc);
}
