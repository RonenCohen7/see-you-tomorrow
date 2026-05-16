import mongoose from "mongoose";
import {
  AppError,
  AUTO_MANAGER_OFFICE_RESERVATION_NOTE,
  DB_NAMES,
  getConnection,
  getLocationModel,
  getParkingReservationModel,
  getParkingSpotModel,
  isAppError,
  logger,
  type LocationDoc,
  type ParkingReservationDoc,
  type ParkingSpotDoc,
} from "@syt/shared";
import * as internalHttp from "./internalHttp.js";
import { utcDay } from "./parkingDate.js";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toPublicSpot(doc: ParkingSpotDoc, locationName?: string) {
  return {
    id: doc._id.toString(),
    locationId: doc.locationId.toString(),
    locationName: locationName ?? "",
    label: doc.label,
    sortOrder: doc.sortOrder,
    assignedEmployeeId: doc.assignedEmployeeId?.toString(),
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toPublicReservation(doc: ParkingReservationDoc, guestFullName?: string) {
  const wd = doc.workDate instanceof Date ? doc.workDate : new Date(doc.workDate);
  return {
    id: doc._id.toString(),
    spotId: doc.spotId.toString(),
    employeeId: doc.employeeId.toString(),
    guestFullName: guestFullName ?? "",
    workDate: iso(wd),
    hourStart: doc.hourStart,
    hourEnd: doc.hourEnd,
    note: doc.note,
    createdBy: doc.createdBy?.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function spotModel() {
  const conn = await getConnection(DB_NAMES.locations);
  return getParkingSpotModel(conn);
}

async function resModel() {
  const conn = await getConnection(DB_NAMES.locations);
  return getParkingReservationModel(conn);
}

async function locModel() {
  const conn = await getConnection(DB_NAMES.locations);
  return getLocationModel(conn);
}

export async function listSpots() {
  const ParkingSpot = await spotModel();
  const Location = await locModel();
  const docs = await ParkingSpot.find({}).sort({ locationId: 1, sortOrder: 1, label: 1 }).lean();
  const locIds = [...new Set(docs.map((d) => d.locationId.toString()))];
  const locs = await Location.find({ _id: { $in: locIds } })
    .select("name")
    .lean();
  const nameBy = new Map(locs.map((l) => [l._id.toString(), (l as unknown as LocationDoc).name]));
  return docs.map((d) => toPublicSpot(d as unknown as ParkingSpotDoc, nameBy.get(d.locationId.toString()) ?? ""));
}

export async function createSpot(locationId: string, label?: string) {
  const ParkingSpot = await spotModel();
  const Location = await locModel();
  const loc = await Location.findById(locationId);
  if (!loc) throw new AppError(404, "מיקום לא נמצא", "NOT_FOUND");

  const maxLean = await ParkingSpot.findOne({ locationId }).sort({ sortOrder: -1 }).select("sortOrder").lean();
  const nextOrder = ((maxLean as { sortOrder?: number } | null)?.sortOrder ?? 0) + 1;
  const resolvedLabel = label?.trim() || `חניה ${nextOrder}`;

  const doc = await ParkingSpot.create({
    locationId,
    label: resolvedLabel,
    sortOrder: nextOrder,
    isActive: true,
  });
  const locName = (loc as unknown as LocationDoc).name ?? "";
  return toPublicSpot(doc as unknown as ParkingSpotDoc, locName);
}

/** Deletes spot and any reservations referencing it (admin-only caller). */
export async function deleteSpot(spotId: string) {
  const ParkingSpot = await spotModel();
  const Reservation = await resModel();
  const doc = await ParkingSpot.findById(spotId);
  if (!doc) throw new AppError(404, "חניה לא נמצאה", "NOT_FOUND");

  await Reservation.deleteMany({ spotId: doc._id });
  await ParkingSpot.deleteOne({ _id: doc._id });
  return { ok: true };
}

export async function seedTenSpots(locationId: string) {
  const ParkingSpot = await spotModel();
  const Location = await locModel();
  const loc = await Location.findById(locationId);
  if (!loc) throw new AppError(404, "מיקום לא נמצא", "NOT_FOUND");
  const existing = await ParkingSpot.countDocuments({ locationId, isActive: true });
  if (existing >= 10) {
    throw new AppError(400, "כבר קיימות לפחות 10 חניות פעילות במיקום זה", "VALIDATION");
  }
  const toCreate = 10 - existing;
  const baseOrder = existing;
  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const n = baseOrder + i + 1;
    const doc = await ParkingSpot.create({
      locationId,
      label: `חניה ${n}`,
      sortOrder: n,
      isActive: true,
    });
    created.push(doc);
  }
  return { created: created.length, items: await listSpots() };
}

export async function updateSpot(
  spotId: string,
  input: Partial<{ label: string; sortOrder: number; assignedEmployeeId: string | null; isActive: boolean }>
) {
  const ParkingSpot = await spotModel();
  const doc = await ParkingSpot.findById(spotId);
  if (!doc) throw new AppError(404, "חניה לא נמצאה", "NOT_FOUND");
  if (input.label !== undefined) doc.label = input.label;
  if (input.sortOrder !== undefined) doc.sortOrder = input.sortOrder;
  if (input.assignedEmployeeId !== undefined) {
    doc.assignedEmployeeId = input.assignedEmployeeId
      ? new mongoose.Types.ObjectId(input.assignedEmployeeId)
      : undefined;
  }
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  await doc.save();
  const Location = await locModel();
  const loc = await Location.findById(doc.locationId).lean();
  const locName = loc ? (loc as unknown as LocationDoc).name : "";
  return toPublicSpot(doc as unknown as ParkingSpotDoc, locName);
}

export async function listReservations(fromIso: string, toIso: string) {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRe.test(fromIso) || !isoRe.test(toIso)) {
    throw new AppError(400, "תאריכים לא תקינים", "VALIDATION");
  }
  const from = utcDay(fromIso);
  const to = utcDay(toIso);
  if (from.getTime() > to.getTime()) throw new AppError(400, "טווח לא תקין", "VALIDATION");
  const Reservation = await resModel();
  const docs = await Reservation.find({
    workDate: { $gte: from, $lte: to },
  })
    .sort({ workDate: 1, spotId: 1 })
    .lean();

  const empIds = [
    ...new Set(
      docs.map((d) => String((d as { employeeId: { toString: () => string } }).employeeId))
    ),
  ];
  const nameEntries = await Promise.all(
    empIds.map(async (id) => {
      const e = await internalHttp.fetchEmployeeInternal(id);
      return [id, e?.fullName ?? ""] as const;
    })
  );
  const nameById = new Map(nameEntries);

  return docs.map((d) => {
    const eid = String((d as { employeeId: { toString: () => string } }).employeeId);
    return toPublicReservation(d as unknown as ParkingReservationDoc, nameById.get(eid) || undefined);
  });
}

export async function createReservation(input: {
  spotId: string;
  employeeId: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
  note?: string;
  createdBy?: string;
  actorRole: "admin" | "manager" | "employee";
  actorUserId: string;
}) {
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRe.test(input.workDate)) throw new AppError(400, "תאריך לא תקין", "VALIDATION");

  if (input.actorRole === "employee" && input.employeeId !== input.actorUserId) {
    throw new AppError(403, "ניתן להקצות רק לעצמך", "FORBIDDEN");
  }

  if (input.actorRole === "manager") {
    const mgr = await internalHttp.fetchEmployeeInternal(input.actorUserId);
    const guest = await internalHttp.fetchEmployeeInternal(input.employeeId);
    if (!mgr?.departmentId || mgr.departmentId !== guest?.departmentId) {
      throw new AppError(403, "ניתן להקצות רק לעובדי המחלקה שלך", "FORBIDDEN");
    }
  }

  const ParkingSpot = await spotModel();
  const spot = await ParkingSpot.findById(input.spotId);
  if (!spot || !spot.isActive) throw new AppError(404, "חניה לא נמצאת", "NOT_FOUND");

  const Reservation = await resModel();
  const workDate = utcDay(input.workDate);
  const dup = await Reservation.findOne({ spotId: spot._id, workDate });
  if (dup) throw new AppError(409, "כבר קיימת הקצאה לחניה בתאריך זה", "CONFLICT");

  const ownerId = spot.assignedEmployeeId?.toString();
  if (ownerId) {
    let batch: { hasOffice: boolean }[];
    try {
      batch = await internalHttp.scheduleOfficePresence([{ employeeId: ownerId, workDate: input.workDate }]);
    } catch {
      throw new AppError(502, "לא ניתן לאמת מול לוח זמנים — נסו שוב מאוחר יותר", "BAD_GATEWAY");
    }
    const first = batch[0];
    if (first?.hasOffice) {
      throw new AppError(
        400,
        "בעל החניה הקבוע משובץ למשרד ביום זה — לא ניתן להקצות חלופי",
        "OWNER_IN_OFFICE"
      );
    }
  }

  const doc = await Reservation.create({
    spotId: spot._id,
    employeeId: new mongoose.Types.ObjectId(input.employeeId),
    workDate,
    hourStart: input.hourStart,
    hourEnd: input.hourEnd,
    note: input.note,
    createdBy: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : undefined,
  });
  const guest = await internalHttp.fetchEmployeeInternal(input.employeeId);
  return toPublicReservation(doc as unknown as ParkingReservationDoc, guest?.fullName);
}

export async function deleteReservation(
  reservationId: string,
  actor: { role: "admin" | "manager" | "employee"; userId: string }
) {
  const Reservation = await resModel();
  const doc = await Reservation.findById(reservationId);
  if (!doc) throw new AppError(404, "הקצאה לא נמצאה", "NOT_FOUND");

  if (actor.role === "employee" && doc.employeeId.toString() !== actor.userId) {
    throw new AppError(403, "אין הרשאה", "FORBIDDEN");
  }

  if (actor.role === "manager") {
    const mgr = await internalHttp.fetchEmployeeInternal(actor.userId);
    const guest = await internalHttp.fetchEmployeeInternal(doc.employeeId.toString());
    if (!mgr?.departmentId || mgr.departmentId !== guest?.departmentId) {
      throw new AppError(403, "אין הרשאה", "FORBIDDEN");
    }
  }

  await Reservation.deleteOne({ _id: doc._id });
  return { ok: true };
}

export async function releaseAutoManagerOfficeReservationsForDay(employeeId: string, workDateIso: string) {
  const Reservation = await resModel();
  await Reservation.deleteMany({
    employeeId: new mongoose.Types.ObjectId(employeeId),
    workDate: utcDay(workDateIso),
    note: AUTO_MANAGER_OFFICE_RESERVATION_NOTE,
  });
}

/**
 * Drops system parking rows for this employee/day, then (if office+locationId) picks the first vacant spot —
 * prefers unassigned guest spots before trying spots with permanent owners checked out via schedule.
 */
export async function syncAutoParkingFromScheduleAssignment(input: {
  employeeId: string;
  workDateIso: string;
  status: string;
  locationId?: string | null;
}): Promise<{ released: boolean; reserved: boolean }> {
  await releaseAutoManagerOfficeReservationsForDay(input.employeeId, input.workDateIso);

  const locHex = typeof input.locationId === "string" ? input.locationId.trim() : "";
  if (input.status !== "office" || locHex.length < 24) {
    return { released: true, reserved: false };
  }

  const emp = await internalHttp.fetchEmployeeInternal(input.employeeId);
  if (!emp || (emp.role !== "manager" && emp.role !== "admin")) {
    return { released: true, reserved: false };
  }

  const ParkingSpot = await spotModel();
  const oidLoc = new mongoose.Types.ObjectId(locHex);
  const owned = await ParkingSpot.findOne({
    locationId: oidLoc,
    assignedEmployeeId: new mongoose.Types.ObjectId(input.employeeId),
    isActive: true,
  })
    .select("_id")
    .lean();

  if (owned) return { released: true, reserved: false };

  const docs = await ParkingSpot.find({ locationId: oidLoc, isActive: true })
    .sort({ sortOrder: 1, label: 1 })
    .lean();

  const spotsRaw = docs as unknown as ParkingSpotDoc[];
  const spotsOpen = spotsRaw.filter((s) => !s.assignedEmployeeId);
  const spotsLinked = spotsRaw.filter((s) => !!s.assignedEmployeeId);
  const ordered = [...spotsOpen, ...spotsLinked];

  for (const spot of ordered) {
    try {
      await createReservation({
        spotId: spot._id.toString(),
        employeeId: input.employeeId,
        workDate: input.workDateIso,
        note: AUTO_MANAGER_OFFICE_RESERVATION_NOTE,
        actorRole: "admin",
        actorUserId: input.employeeId,
      });
      return { released: true, reserved: true };
    } catch (e) {
      if (isAppError(e) && (e.code === "OWNER_IN_OFFICE" || e.code === "CONFLICT")) continue;
      logger.warn("auto manager parking reservation failed", {
        employeeId: input.employeeId,
        workDateIso: input.workDateIso,
        spotId: String(spot._id),
        err: String(e),
      });
      break;
    }
  }

  return { released: true, reserved: false };
}
